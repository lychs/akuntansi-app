-- ============================================================================
-- MIGRASI TAMBAHAN #13: Retur Pembelian/Penjualan, Rekap Pembelian-Penjualan,
-- dan Lampiran Bukti Transaksi (PDF/gambar).
--
-- CATATAN PENTING: kalau muncul error "unsafe use of new value of enum type"
-- saat Run, jalankan DULU 2 baris paling atas (yang "alter type
-- transaction_type add value...") SENDIRIAN sebagai 1 query terpisah, klik
-- Run, baru abis itu select-all sisa SQL di bawahnya dan Run lagi sebagai
-- query kedua.
--
-- Jalankan SETELAH migrasi v12.
-- ============================================================================

alter type transaction_type add value if not exists 'retur_pembelian';
alter type transaction_type add value if not exists 'retur_penjualan';

-- ----------------------------------------------------------------------------
-- 1. Akun "Retur Penjualan" (contra-revenue) — dibutuhkan buat mengurangi
--    Pendapatan Penjualan Barang secara otomatis di Laba Rugi saat ada retur.
--    Kategori tetap "pendapatan" (normal_balance kredit, sama kayak akun
--    pendapatan lain) — tapi karena transaksi retur men-DEBIT akun ini,
--    saldonya otomatis mengurangi total pendapatan pas dijumlah di laporan,
--    tanpa perlu logika khusus di kode laporan.
-- ----------------------------------------------------------------------------
alter table companies add column if not exists sales_return_account_id uuid references accounts(id);

do $$
declare
  v_company record;
  v_account_id uuid;
begin
  for v_company in select id from companies where business_type = 'dagang' and sales_return_account_id is null
  loop
    insert into accounts (company_id, code, name, category, normal_balance, description, is_locked)
      values (v_company.id, '4-41500', 'Retur Penjualan', 'pendapatan', 'kredit', 'Akun kontra-pendapatan otomatis untuk retur penjualan', true)
      on conflict (company_id, code) do nothing
      returning id into v_account_id;
    if v_account_id is not null then
      update companies set sales_return_account_id = v_account_id where id = v_company.id;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. RPC: record_purchase_return — Retur Pembelian. Kurangi stok di cabang
--    (konsumsi layer sesuai metode persediaan perusahaan), uangnya balik ke
--    kas/bank ATAU mengurangi hutang ke supplier (tergantung akun yang dipilih).
-- ----------------------------------------------------------------------------
create or replace function record_purchase_return(
  p_company_id uuid, p_date timestamptz, p_contact_id uuid, p_product_id uuid, p_cost_center_id uuid,
  p_qty numeric, p_refund_account_id uuid, p_note text
) returns uuid as $$
declare
  v_inventory_account_id uuid; v_method text; v_txn_id uuid;
  v_qty_on_hand numeric; v_avg_cost numeric;
  v_remaining_to_consume numeric; v_layer record; v_consume numeric; v_total_cost numeric := 0;
  v_layer_id uuid; v_layer_qty numeric; v_layer_cost numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat retur pembelian di perusahaan ini';
  end if;
  if p_cost_center_id is null then raise exception 'Pilih cabang asal retur ini dulu'; end if;
  if p_qty <= 0 then raise exception 'Qty retur harus lebih dari 0'; end if;

  select inventory_account_id, inventory_method into v_inventory_account_id, v_method from companies where id = p_company_id;
  if v_inventory_account_id is null then raise exception 'Perusahaan ini belum diset sebagai usaha Dagang'; end if;

  select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_on_hand, v_avg_cost
    from product_branch_stock where product_id = p_product_id and cost_center_id = p_cost_center_id for update;
  v_qty_on_hand := coalesce(v_qty_on_hand, 0);
  if v_qty_on_hand < p_qty then
    raise exception 'Stok di cabang ini gak cukup buat diretur (sisa: %, diminta: %)', v_qty_on_hand, p_qty;
  end if;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, created_by)
    values (p_company_id, p_date, 'retur_pembelian', coalesce(nullif(trim(p_note),''), 'Retur pembelian barang'), p_contact_id, p_cost_center_id, auth.uid())
    returning id into v_txn_id;

  if v_method = 'average' then
    v_total_cost := p_qty * v_avg_cost;
    insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
      values (p_company_id, p_product_id, v_txn_id, p_date, 'out', p_qty, v_avg_cost, v_total_cost, p_note, p_cost_center_id);
  else
    v_remaining_to_consume := p_qty;
    for v_layer in
      select id, qty_remaining, unit_cost from product_stock_layers
      where product_id = p_product_id and cost_center_id = p_cost_center_id and qty_remaining > 0
      order by purchase_date desc, created_at desc for update -- retur biasanya dari batch TERBARU yang baru dibeli
    loop
      exit when v_remaining_to_consume <= 0;
      v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
      update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
      v_total_cost := v_total_cost + (v_consume * v_layer.unit_cost);
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
        values (p_company_id, p_product_id, v_txn_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note, p_cost_center_id);
      v_remaining_to_consume := v_remaining_to_consume - v_consume;
    end loop;
    if v_remaining_to_consume > 0 then raise exception 'Stok gak konsisten di cabang ini — hubungi admin'; end if;
  end if;

  perform adjust_branch_stock(p_company_id, p_product_id, p_cost_center_id, -p_qty, v_avg_cost);

  if v_total_cost > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, p_refund_account_id, v_total_cost, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_inventory_account_id, 0, v_total_cost);
  end if;

  return v_txn_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 3. RPC: record_sales_return — Retur Penjualan. Tambah stok balik ke cabang
--    (pakai harga pokok rata-rata SEKARANG di cabang itu), kurangi Pendapatan
--    (lewat akun kontra "Retur Penjualan") & balikin HPP, uang balik ke
--    customer ATAU mengurangi piutang (tergantung akun yang dipilih).
-- ----------------------------------------------------------------------------
create or replace function record_sales_return(
  p_company_id uuid, p_date timestamptz, p_contact_id uuid, p_product_id uuid, p_cost_center_id uuid,
  p_qty numeric, p_sale_price numeric, p_refund_account_id uuid, p_note text
) returns uuid as $$
declare
  v_inventory_account_id uuid; v_cogs_account_id uuid; v_sales_return_account_id uuid; v_method text;
  v_txn_id uuid; v_qty_before numeric; v_avg_before numeric; v_new_avg numeric;
  v_total_revenue_reversal numeric; v_total_cost numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat retur penjualan di perusahaan ini';
  end if;
  if p_cost_center_id is null then raise exception 'Pilih cabang tujuan retur ini dulu'; end if;
  if p_qty <= 0 then raise exception 'Qty retur harus lebih dari 0'; end if;

  select inventory_account_id, cogs_account_id, sales_return_account_id, inventory_method
    into v_inventory_account_id, v_cogs_account_id, v_sales_return_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then raise exception 'Perusahaan ini belum diset sebagai usaha Dagang'; end if;
  if v_sales_return_account_id is null then raise exception 'Akun "Retur Penjualan" belum ada — hubungi admin buat jalanin migrasi terbaru'; end if;

  select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_before, v_avg_before
    from product_branch_stock where product_id = p_product_id and cost_center_id = p_cost_center_id for update;
  v_qty_before := coalesce(v_qty_before, 0);
  v_avg_before := coalesce(v_avg_before, 0);
  -- Barang yang diretur dimasukin lagi dengan biaya = harga pokok rata-rata SAAT INI
  -- di cabang itu (pendekatan standar — gak nelusur balik ke batch asal penjualannya).
  v_total_cost := p_qty * v_avg_before;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, created_by)
    values (p_company_id, p_date, 'retur_penjualan', coalesce(nullif(trim(p_note),''), 'Retur penjualan barang'), p_contact_id, p_cost_center_id, auth.uid())
    returning id into v_txn_id;

  insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id, cost_center_id)
    values (p_company_id, p_product_id, p_date::date, p_qty, v_avg_before, v_txn_id, p_cost_center_id);
  insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
    values (p_company_id, p_product_id, v_txn_id, p_date, 'in', p_qty, v_avg_before, v_total_cost, p_note, p_cost_center_id);

  v_new_avg := case when (v_qty_before + p_qty) > 0 then ((v_qty_before * v_avg_before) + v_total_cost) / (v_qty_before + p_qty) else 0 end;
  perform adjust_branch_stock(p_company_id, p_product_id, p_cost_center_id, p_qty, v_new_avg);

  v_total_revenue_reversal := p_qty * p_sale_price;

  if v_total_revenue_reversal > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_sales_return_account_id, v_total_revenue_reversal, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, p_refund_account_id, 0, v_total_revenue_reversal);
  end if;
  if v_total_cost > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_inventory_account_id, v_total_cost, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_cogs_account_id, 0, v_total_cost);
  end if;

  return v_txn_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 4. RPC: get_purchase_sales_recap — Rekap Pembelian & Penjualan per Produk
--    (dan per Cabang kalau gak difilter salah satu cabang spesifik).
-- ----------------------------------------------------------------------------
create or replace function get_purchase_sales_recap(
  p_company_id uuid, p_start date, p_end date, p_cost_center_id uuid default null
)
returns table (
  product_id uuid, product_code text, product_name text, unit text,
  cost_center_id uuid, cost_center_name text,
  qty_purchased numeric, value_purchased numeric,
  qty_sold numeric, value_sold numeric,
  qty_returned_purchase numeric, qty_returned_sales numeric
) as $$
  select
    p.id, p.code, p.name, p.unit,
    cc.id, cc.name,
    coalesce(sum(case when t.type = 'pembelian_barang' then pm.qty else 0 end), 0),
    coalesce(sum(case when t.type = 'pembelian_barang' then pm.total_cost else 0 end), 0),
    coalesce(sum(case when t.type = 'penjualan_barang' then pm.qty else 0 end), 0),
    coalesce(sum(case when t.type = 'penjualan_barang' then pm.total_cost else 0 end), 0),
    coalesce(sum(case when t.type = 'retur_pembelian' then pm.qty else 0 end), 0),
    coalesce(sum(case when t.type = 'retur_penjualan' then pm.qty else 0 end), 0)
  from product_movements pm
  join products p on p.id = pm.product_id
  join transactions t on t.id = pm.transaction_id
  left join cost_centers cc on cc.id = pm.cost_center_id
  where pm.company_id = p_company_id and pm.date >= p_start and pm.date < (p_end + 1)
    and (p_cost_center_id is null or pm.cost_center_id = p_cost_center_id)
    and t.type in ('pembelian_barang','penjualan_barang','retur_pembelian','retur_penjualan')
  group by p.id, p.code, p.name, p.unit, cc.id, cc.name
  order by p.name, cc.name;
$$ language sql stable security invoker;

-- ----------------------------------------------------------------------------
-- 5. Lampiran bukti transaksi (PDF/gambar) — kolom + storage bucket privat.
-- ----------------------------------------------------------------------------
alter table transactions add column if not exists receipt_path text;

insert into storage.buckets (id, name, public)
  values ('transaction-receipts', 'transaction-receipts', false)
  on conflict (id) do nothing;

-- Path wajib diawali company_id (folder pertama) — biar bisa dicek RLS-nya
-- pakai is_company_editor/is_company_member.
drop policy if exists "editor can upload receipts" on storage.objects;
create policy "editor can upload receipts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'transaction-receipts'
    and is_company_editor(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "member can view receipts" on storage.objects;
create policy "member can view receipts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and is_company_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "editor can delete receipts" on storage.objects;
create policy "editor can delete receipts" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and is_company_editor(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- 6. Ganti create_transaction: sekalian bisa nyimpen receipt_path (menyambung
--    dari versi v11 — semua perilaku sebelumnya tetap ada).
-- ----------------------------------------------------------------------------
create or replace function create_transaction(
  p_company_id uuid, p_date timestamptz, p_type transaction_type, p_note text, p_contact_id uuid, p_lines jsonb,
  p_due_date date default null, p_invoice_no text default null, p_cost_center_id uuid default null,
  p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null,
  p_receipt_path text default null
) returns uuid as $$
declare
  v_txn_id uuid; v_line jsonb; v_account_id uuid; v_debit numeric; v_credit numeric;
  v_category text; v_asset_code text; v_asset_seq int; v_rp_amount numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, department_id, project_id, warehouse_id, receipt_path, created_by)
    values (p_company_id, p_date, p_type, p_note, p_contact_id, p_cost_center_id, p_department_id, p_project_id, p_warehouse_id, p_receipt_path, auth.uid())
    returning id into v_txn_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_account_id, v_debit, v_credit);
    select category into v_category from accounts where id = v_account_id;

    if v_debit > 0 and v_category = 'harta_tetap' then
      select count(*) + 1 into v_asset_seq from assets where company_id = p_company_id;
      v_asset_code := 'AST-' || to_char(p_date, 'YYYYMM') || '-' || lpad(v_asset_seq::text, 3, '0');
      insert into assets (company_id, code, name, account_id, description, acquisition_date, acquisition_cost)
        values (p_company_id, v_asset_code, coalesce(nullif(trim(p_note), ''), 'Aset ' || v_asset_code), v_account_id, p_note, p_date::date, v_debit);
    end if;

    if p_type = 'piutang' and v_category = 'piutang' and v_debit > 0 then v_rp_amount := v_debit;
    elsif p_type = 'hutang' and v_category = 'hutang' and v_credit > 0 then v_rp_amount := v_credit;
    else v_rp_amount := null; end if;

    if v_rp_amount is not null then
      if p_contact_id is null then raise exception 'Transaksi Hutang/Piutang wajib pilih kontak'; end if;
      insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id, department_id, project_id, warehouse_id)
        values (p_company_id, v_txn_id, p_contact_id,
          case when p_type = 'piutang' then 'piutang'::receivable_payable_type else 'hutang'::receivable_payable_type end,
          p_invoice_no, p_date::date, p_due_date, v_rp_amount, p_cost_center_id, p_department_id, p_project_id, p_warehouse_id);
    end if;
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security invoker;

-- record_purchase, record_sale, record_opening_stock, record_stock_opname
-- juga dikasih p_receipt_path opsional biar konsisten.
create or replace function record_purchase(
  p_company_id uuid, p_date timestamptz, p_contact_id uuid, p_note text, p_payment_account_id uuid, p_lines jsonb,
  p_cost_center_id uuid default null, p_receipt_path text default null
) returns uuid as $$
declare
  v_transaction_id uuid; v_inventory_account_id uuid; v_line jsonb;
  v_product_id uuid; v_qty numeric; v_unit_cost numeric; v_total numeric := 0;
  v_qty_before numeric; v_avg_before numeric; v_method text;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat pembelian di perusahaan ini';
  end if;
  if p_cost_center_id is null then raise exception 'Pilih cabang tujuan pembelian ini dulu'; end if;
  select inventory_account_id, inventory_method into v_inventory_account_id, v_method from companies where id = p_company_id;
  if v_inventory_account_id is null then raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada'; end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Minimal 1 baris barang'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total := v_total + (v_line->>'qty')::numeric * (v_line->>'unit_cost')::numeric;
  end loop;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, receipt_path, created_by)
    values (p_company_id, p_date, 'pembelian_barang', p_note, p_contact_id, p_cost_center_id, p_receipt_path, auth.uid())
    returning id into v_transaction_id;

  if v_total > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_inventory_account_id, v_total, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, p_payment_account_id, 0, v_total);
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_unit_cost := (v_line->>'unit_cost')::numeric;
    if v_qty <= 0 or v_unit_cost < 0 then raise exception 'Qty dan harga beli tidak valid'; end if;

    insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id, cost_center_id)
      values (p_company_id, v_product_id, p_date::date, v_qty, v_unit_cost, v_transaction_id, p_cost_center_id);
    insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
      values (p_company_id, v_product_id, v_transaction_id, p_date, 'in', v_qty, v_unit_cost, v_qty * v_unit_cost, p_note, p_cost_center_id);

    select coalesce(qty_on_hand, 0), coalesce(avg_unit_cost, 0) into v_qty_before, v_avg_before
      from product_branch_stock where product_id = v_product_id and cost_center_id = p_cost_center_id;
    v_qty_before := coalesce(v_qty_before, 0);
    v_avg_before := coalesce(v_avg_before, 0);

    if v_method = 'average' then
      perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, v_qty,
        case when (v_qty_before + v_qty) > 0 then ((v_qty_before * v_avg_before) + (v_qty * v_unit_cost)) / (v_qty_before + v_qty) else 0 end);
    else
      perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, v_qty, v_avg_before);
    end if;
  end loop;

  return v_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function record_sale(
  p_company_id uuid, p_date timestamptz, p_contact_id uuid, p_note text, p_receive_account_id uuid, p_lines jsonb,
  p_cost_center_id uuid default null, p_receipt_path text default null
) returns uuid as $$
declare
  v_transaction_id uuid; v_inventory_account_id uuid; v_cogs_account_id uuid; v_revenue_account_id uuid; v_method text;
  v_line jsonb; v_product_id uuid; v_qty numeric; v_sale_price numeric;
  v_total_revenue numeric := 0; v_total_cogs numeric := 0; v_line_cogs numeric;
  v_remaining_to_consume numeric; v_layer record; v_consume numeric;
  v_qty_on_hand numeric; v_avg_cost numeric; v_layer_id uuid; v_layer_qty numeric; v_layer_cost numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat penjualan di perusahaan ini';
  end if;
  if p_cost_center_id is null then raise exception 'Pilih cabang asal penjualan ini dulu'; end if;
  select inventory_account_id, cogs_account_id, sales_revenue_account_id, inventory_method
    into v_inventory_account_id, v_cogs_account_id, v_revenue_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada'; end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Minimal 1 baris barang'; end if;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, receipt_path, created_by)
    values (p_company_id, p_date, 'penjualan_barang', p_note, p_contact_id, p_cost_center_id, p_receipt_path, auth.uid())
    returning id into v_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_sale_price := (v_line->>'sale_price')::numeric;
    if v_qty <= 0 then raise exception 'Qty tidak valid'; end if;

    select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_on_hand, v_avg_cost
      from product_branch_stock where product_id = v_product_id and cost_center_id = p_cost_center_id
      for update;
    v_qty_on_hand := coalesce(v_qty_on_hand, 0);
    if v_qty_on_hand < v_qty then
      raise exception 'Stok tidak cukup di cabang ini untuk salah satu barang (sisa stok cabang: %, diminta: %)', v_qty_on_hand, v_qty;
    end if;

    v_total_revenue := v_total_revenue + (v_qty * v_sale_price);

    if v_method = 'average' then
      v_line_cogs := v_qty * v_avg_cost;
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
        values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_avg_cost, v_line_cogs, p_note, p_cost_center_id);
      perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, -v_qty, v_avg_cost);

    elsif v_method = 'specific' then
      v_layer_id := (v_line->>'layer_id')::uuid;
      if v_layer_id is null then raise exception 'Metode Identifikasi Khusus butuh pilihan unit/batch spesifik per baris'; end if;
      select qty_remaining, unit_cost into v_layer_qty, v_layer_cost
        from product_stock_layers where id = v_layer_id and product_id = v_product_id and cost_center_id = p_cost_center_id for update;
      if v_layer_qty is null or v_layer_qty < v_qty then
        raise exception 'Unit/batch yang dipilih gak punya sisa cukup di cabang ini';
      end if;
      update product_stock_layers set qty_remaining = qty_remaining - v_qty where id = v_layer_id;
      v_line_cogs := v_qty * v_layer_cost;
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
        values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_layer_cost, v_line_cogs, p_note, p_cost_center_id);
      perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, -v_qty, v_avg_cost);

    else
      v_line_cogs := 0;
      v_remaining_to_consume := v_qty;
      for v_layer in
        select id, qty_remaining, unit_cost from product_stock_layers
        where product_id = v_product_id and cost_center_id = p_cost_center_id and qty_remaining > 0
        order by purchase_date asc, created_at asc for update
      loop
        exit when v_remaining_to_consume <= 0;
        v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
        update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
        v_line_cogs := v_line_cogs + (v_consume * v_layer.unit_cost);
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note, p_cost_center_id);
        v_remaining_to_consume := v_remaining_to_consume - v_consume;
      end loop;
      if v_remaining_to_consume > 0 then raise exception 'Stok FIFO tidak konsisten di cabang ini — hubungi admin'; end if;
      perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, -v_qty, v_avg_cost);
    end if;

    v_total_cogs := v_total_cogs + v_line_cogs;
  end loop;

  if v_total_revenue > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, p_receive_account_id, v_total_revenue, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_revenue_account_id, 0, v_total_revenue);
  end if;
  if v_total_cogs > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_cogs_account_id, v_total_cogs, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_inventory_account_id, 0, v_total_cogs);
  end if;

  return v_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 7. get_transaction_report: sekalian bawa receipt_path (buat tombol
--    "Lihat Bukti" & fitur cetak dokumen di Laporan Transaksi).
-- ----------------------------------------------------------------------------
create or replace function get_transaction_report(
  p_company_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns table (
  id uuid, date timestamptz, type text, note text, contact_name text, total_amount numeric, receipt_path text
) as $$
  select t.id, t.date, t.type::text, t.note, c.name,
    coalesce((select sum(je.debit) from journal_entries je where je.transaction_id = t.id), 0),
    t.receipt_path
  from transactions t
  left join contacts c on c.id = t.contact_id
  where t.company_id = p_company_id and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
  order by t.date desc;
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 8. RPC: get_transaction_line_items — rincian barang (kalau transaksinya
--    dari modul Dagang) buat ditampilkan di dokumen cetak (Faktur, Nota, dll).
-- ----------------------------------------------------------------------------
create or replace function get_transaction_line_items(p_transaction_id uuid)
returns table (product_name text, unit text, qty numeric, unit_cost numeric, total_cost numeric) as $$
  select p.name, p.unit, pm.qty, pm.unit_cost, pm.total_cost
  from product_movements pm
  join products p on p.id = pm.product_id
  where pm.transaction_id = p_transaction_id
  order by p.name;
$$ language sql stable security invoker;

-- ----------------------------------------------------------------------------
-- 9. record_opening_stock & record_stock_opname: sekalian dikasih
--    p_receipt_path opsional juga, biar konsisten semua transaksi Dagang bisa
--    attach bukti (menyambung dari versi sebelumnya, semua perilaku lama tetap ada).
-- ----------------------------------------------------------------------------
create or replace function record_opening_stock(
  p_company_id uuid, p_date timestamptz, p_note text, p_lines jsonb, p_cost_center_id uuid default null,
  p_receipt_path text default null
) returns uuid as $$
declare
  v_txn_id uuid; v_inventory_account_id uuid; v_ob_account uuid; v_method text;
  v_line jsonb; v_product_id uuid; v_qty numeric; v_unit_cost numeric; v_total numeric := 0;
  v_qty_before numeric; v_avg_before numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if p_cost_center_id is null then raise exception 'Pilih cabang buat saldo awal persediaan ini dulu'; end if;
  select inventory_account_id, inventory_method into v_inventory_account_id, v_method from companies where id = p_company_id;
  if v_inventory_account_id is null then raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada'; end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Minimal 1 baris produk'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total := v_total + (v_line->>'qty')::numeric * (v_line->>'unit_cost')::numeric;
  end loop;
  if v_total <= 0 then raise exception 'Total saldo awal persediaan harus lebih dari 0'; end if;

  v_ob_account := get_or_create_opening_balance_account(p_company_id);

  insert into transactions (company_id, date, type, note, cost_center_id, receipt_path, created_by)
    values (p_company_id, p_date, 'saldo_awal', p_note, p_cost_center_id, p_receipt_path, auth.uid())
    returning id into v_txn_id;

  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_inventory_account_id, v_total, 0);
  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_ob_account, 0, v_total);

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_unit_cost := (v_line->>'unit_cost')::numeric;
    if v_qty <= 0 or v_unit_cost < 0 then raise exception 'Qty dan harga tidak valid'; end if;

    insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id, cost_center_id)
      values (p_company_id, v_product_id, p_date::date, v_qty, v_unit_cost, v_txn_id, p_cost_center_id);
    insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
      values (p_company_id, v_product_id, v_txn_id, p_date, 'in', v_qty, v_unit_cost, v_qty * v_unit_cost, p_note, p_cost_center_id);

    select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_before, v_avg_before
      from product_branch_stock where product_id = v_product_id and cost_center_id = p_cost_center_id;
    v_qty_before := coalesce(v_qty_before, 0);
    v_avg_before := coalesce(v_avg_before, 0);

    perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, v_qty,
      case when (v_qty_before + v_qty) > 0 then ((v_qty_before * v_avg_before) + (v_qty * v_unit_cost)) / (v_qty_before + v_qty) else 0 end);
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function record_stock_opname(
  p_company_id uuid, p_date timestamptz, p_note text, p_lines jsonb, p_cost_center_id uuid default null,
  p_receipt_path text default null
) returns uuid as $$
declare
  v_transaction_id uuid; v_inventory_account_id uuid; v_variance_account_id uuid; v_method text;
  v_line jsonb; v_product_id uuid; v_counted_qty numeric; v_manual_unit_cost numeric;
  v_qty_on_hand numeric; v_avg_cost numeric; v_diff numeric;
  v_total_shortage_cost numeric := 0; v_total_overage_value numeric := 0;
  v_line_cost numeric; v_remaining_to_consume numeric; v_layer record; v_consume numeric;
  v_any_line boolean := false;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat stock opname di perusahaan ini';
  end if;
  if p_cost_center_id is null then raise exception 'Pilih cabang yang mau di-opname dulu'; end if;
  select inventory_account_id, opname_variance_account_id, inventory_method
    into v_inventory_account_id, v_variance_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then raise exception 'Perusahaan ini belum diset sebagai usaha Dagang'; end if;

  insert into transactions (company_id, date, type, note, cost_center_id, receipt_path, created_by)
    values (p_company_id, p_date, 'penyesuaian', p_note, p_cost_center_id, p_receipt_path, auth.uid())
    returning id into v_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_counted_qty := (v_line->>'counted_qty')::numeric;
    v_manual_unit_cost := nullif(v_line->>'unit_cost', '')::numeric;

    select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_on_hand, v_avg_cost
      from product_branch_stock where product_id = v_product_id and cost_center_id = p_cost_center_id for update;
    v_qty_on_hand := coalesce(v_qty_on_hand, 0);
    v_avg_cost := coalesce(v_avg_cost, 0);
    v_diff := v_counted_qty - v_qty_on_hand;
    if v_diff = 0 then continue; end if;
    v_any_line := true;

    if v_diff < 0 then
      v_remaining_to_consume := abs(v_diff);
      v_line_cost := 0;
      if v_method = 'average' then
        v_line_cost := v_remaining_to_consume * v_avg_cost;
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_remaining_to_consume, v_avg_cost, v_line_cost, p_note, p_cost_center_id);
      else
        for v_layer in
          select id, qty_remaining, unit_cost from product_stock_layers
          where product_id = v_product_id and cost_center_id = p_cost_center_id and qty_remaining > 0
          order by purchase_date asc, created_at asc for update
        loop
          exit when v_remaining_to_consume <= 0;
          v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
          update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
          v_line_cost := v_line_cost + (v_consume * v_layer.unit_cost);
          insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
            values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note, p_cost_center_id);
          v_remaining_to_consume := v_remaining_to_consume - v_consume;
        end loop;
      end if;
      v_total_shortage_cost := v_total_shortage_cost + v_line_cost;
      perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, v_diff, v_avg_cost);

    else
      declare
        v_unit_cost numeric := coalesce(v_manual_unit_cost, nullif(v_avg_cost, 0));
      begin
        if v_unit_cost is null then
          raise exception 'Produk ini belum punya harga pokok di cabang ini — isi "unit_cost" manual buat baris selisih lebih';
        end if;
        insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id, cost_center_id)
          values (p_company_id, v_product_id, p_date::date, v_diff, v_unit_cost, v_transaction_id, p_cost_center_id);
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'in', v_diff, v_unit_cost, v_diff * v_unit_cost, p_note, p_cost_center_id);
        v_total_overage_value := v_total_overage_value + (v_diff * v_unit_cost);
        perform adjust_branch_stock(p_company_id, v_product_id, p_cost_center_id, v_diff,
          case when (v_qty_on_hand + v_diff) > 0 then ((v_qty_on_hand * v_avg_cost) + (v_diff * v_unit_cost)) / (v_qty_on_hand + v_diff) else 0 end);
      end;
    end if;
  end loop;

  if not v_any_line then
    raise exception 'Gak ada selisih stok — semua qty hasil hitung fisik sudah sama dengan catatan sistem';
  end if;

  if v_total_shortage_cost > v_total_overage_value then
    declare v_net numeric := v_total_shortage_cost - v_total_overage_value; begin
      insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_variance_account_id, v_net, 0);
      insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_inventory_account_id, 0, v_net);
    end;
  elsif v_total_overage_value > v_total_shortage_cost then
    declare v_net numeric := v_total_overage_value - v_total_shortage_cost; begin
      insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_inventory_account_id, v_net, 0);
      insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_variance_account_id, 0, v_net);
    end;
  end if;

  return v_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;
