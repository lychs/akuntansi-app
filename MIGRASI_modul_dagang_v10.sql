-- ============================================================================
-- MIGRASI TAMBAHAN #10: Persediaan per Cabang + Transfer Antar Cabang +
-- Dimension tambahan (Department/Project/Warehouse)
--
-- INI MIGRASI BESAR — mengubah cara stok dihitung (dari company-wide jadi
-- per-cabang). Jalankan SETELAH migrasi v9. WAJIB backup/export data dulu
-- kalau sudah ada transaksi pembelian/penjualan barang yang sudah pernah
-- dicatat sebelum migrasi ini, karena stok existing akan dianggap "tanpa
-- cabang" (cost_center_id = null) sampai kamu atur ulang manual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Dimension tambahan: Department, Project, Warehouse (struktur sama
--    seperti cost_centers yang sudah ada, dipakai sebagai "Cabang").
-- ----------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null, name text not null, description text,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique (company_id, code)
);
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null, name text not null, description text,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique (company_id, code)
);
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null, name text not null, description text,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique (company_id, code)
);
alter table departments enable row level security;
alter table projects enable row level security;
alter table warehouses enable row level security;

do $$
declare v_tbl text;
begin
  foreach v_tbl in array array['departments','projects','warehouses'] loop
    execute format('drop policy if exists "member can view %1$s" on %1$s', v_tbl);
    execute format('create policy "member can view %1$s" on %1$s for select using (is_company_member(company_id))', v_tbl);
    execute format('drop policy if exists "editor can insert %1$s" on %1$s', v_tbl);
    execute format('create policy "editor can insert %1$s" on %1$s for insert with check (is_company_editor(company_id))', v_tbl);
    execute format('drop policy if exists "editor can update %1$s" on %1$s', v_tbl);
    execute format('create policy "editor can update %1$s" on %1$s for update using (is_company_editor(company_id))', v_tbl);
    execute format('drop policy if exists "editor can delete %1$s" on %1$s', v_tbl);
    execute format('create policy "editor can delete %1$s" on %1$s for delete using (is_company_editor(company_id))', v_tbl);
  end loop;
end $$;

alter table transactions add column if not exists department_id uuid references departments(id);
alter table transactions add column if not exists project_id uuid references projects(id);
alter table transactions add column if not exists warehouse_id uuid references warehouses(id);

-- ----------------------------------------------------------------------------
-- 2. Persediaan per cabang: tandai layer & mutasi dengan cabang (cost_center_id
--    dipakai sebagai "Branch"), plus tabel ringkasan stok per produk PER CABANG.
-- ----------------------------------------------------------------------------
alter table product_stock_layers add column if not exists cost_center_id uuid references cost_centers(id);
alter table product_movements add column if not exists cost_center_id uuid references cost_centers(id);

create table if not exists product_branch_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  cost_center_id uuid not null references cost_centers(id) on delete cascade,
  qty_on_hand numeric not null default 0,
  avg_unit_cost numeric not null default 0,
  unique (product_id, cost_center_id)
);
alter table product_branch_stock enable row level security;
drop policy if exists "member can view branch stock" on product_branch_stock;
create policy "member can view branch stock" on product_branch_stock
  for select using (is_company_member(company_id));

create or replace function sync_product_company_totals(p_product_id uuid) returns void as $$
declare
  v_total_qty numeric;
  v_total_value numeric;
begin
  select coalesce(sum(qty_on_hand), 0), coalesce(sum(qty_on_hand * avg_unit_cost), 0)
    into v_total_qty, v_total_value
    from product_branch_stock where product_id = p_product_id;
  update products set
    qty_on_hand = v_total_qty,
    avg_unit_cost = case when v_total_qty > 0 then v_total_value / v_total_qty else 0 end
  where id = p_product_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function adjust_branch_stock(
  p_company_id uuid, p_product_id uuid, p_cost_center_id uuid, p_qty_delta numeric, p_new_avg_cost numeric
) returns void as $$
begin
  insert into product_branch_stock (company_id, product_id, cost_center_id, qty_on_hand, avg_unit_cost)
    values (p_company_id, p_product_id, p_cost_center_id, greatest(p_qty_delta, 0), p_new_avg_cost)
  on conflict (product_id, cost_center_id) do update
    set qty_on_hand = product_branch_stock.qty_on_hand + p_qty_delta,
        avg_unit_cost = p_new_avg_cost;
  perform sync_product_company_totals(p_product_id);
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 3. Ganti create_transaction: tambah department_id/project_id/warehouse_id
--    (menyambung dari versi v9 — semua perilaku sebelumnya tetap ada).
-- ----------------------------------------------------------------------------
create or replace function create_transaction(
  p_company_id uuid, p_date timestamptz, p_type transaction_type, p_note text, p_contact_id uuid, p_lines jsonb,
  p_due_date date default null, p_invoice_no text default null, p_cost_center_id uuid default null,
  p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
) returns uuid as $$
declare
  v_txn_id uuid; v_line jsonb; v_account_id uuid; v_debit numeric; v_credit numeric;
  v_category text; v_asset_code text; v_asset_seq int; v_rp_amount numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, department_id, project_id, warehouse_id, created_by)
    values (p_company_id, p_date, p_type, p_note, p_contact_id, p_cost_center_id, p_department_id, p_project_id, p_warehouse_id, auth.uid())
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
      insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id)
        values (p_company_id, v_txn_id, p_contact_id,
          case when p_type = 'piutang' then 'piutang'::receivable_payable_type else 'hutang'::receivable_payable_type end,
          p_invoice_no, p_date::date, p_due_date, v_rp_amount, p_cost_center_id);
    end if;
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- 4. Ganti record_purchase: WAJIB cabang (cost_center_id), stok masuk ke
--    cabang itu spesifik, bukan kolam company-wide lagi.
-- ----------------------------------------------------------------------------
create or replace function record_purchase(
  p_company_id uuid, p_date timestamptz, p_contact_id uuid, p_note text, p_payment_account_id uuid, p_lines jsonb,
  p_cost_center_id uuid default null
) returns uuid as $$
declare
  v_transaction_id uuid; v_inventory_account_id uuid; v_line jsonb;
  v_product_id uuid; v_qty numeric; v_unit_cost numeric; v_total numeric := 0;
  v_qty_before numeric; v_avg_before numeric; v_method text;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat pembelian di perusahaan ini';
  end if;
  if p_cost_center_id is null then
    raise exception 'Pilih cabang tujuan pembelian ini dulu';
  end if;
  select inventory_account_id, inventory_method into v_inventory_account_id, v_method from companies where id = p_company_id;
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada';
  end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Minimal 1 baris barang'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total := v_total + (v_line->>'qty')::numeric * (v_line->>'unit_cost')::numeric;
  end loop;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, created_by)
    values (p_company_id, p_date, 'pembelian_barang', p_note, p_contact_id, p_cost_center_id, auth.uid())
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

-- ----------------------------------------------------------------------------
-- 5. Ganti record_sale: WAJIB cabang, FIFO/Identifikasi Khusus konsumsi layer
--    KHUSUS cabang itu aja, validasi stok per cabang (bukan company-wide).
-- ----------------------------------------------------------------------------
create or replace function record_sale(
  p_company_id uuid, p_date timestamptz, p_contact_id uuid, p_note text, p_receive_account_id uuid, p_lines jsonb,
  p_cost_center_id uuid default null
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
  if p_cost_center_id is null then
    raise exception 'Pilih cabang asal penjualan ini dulu';
  end if;
  select inventory_account_id, cogs_account_id, sales_revenue_account_id, inventory_method
    into v_inventory_account_id, v_cogs_account_id, v_revenue_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada';
  end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Minimal 1 baris barang'; end if;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, created_by)
    values (p_company_id, p_date, 'penjualan_barang', p_note, p_contact_id, p_cost_center_id, auth.uid())
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
-- 6. Ganti record_opening_stock: WAJIB cabang juga.
-- ----------------------------------------------------------------------------
create or replace function record_opening_stock(
  p_company_id uuid, p_date timestamptz, p_note text, p_lines jsonb, p_cost_center_id uuid default null
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
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada';
  end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Minimal 1 baris produk'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total := v_total + (v_line->>'qty')::numeric * (v_line->>'unit_cost')::numeric;
  end loop;
  if v_total <= 0 then raise exception 'Total saldo awal persediaan harus lebih dari 0'; end if;

  v_ob_account := get_or_create_opening_balance_account(p_company_id);

  insert into transactions (company_id, date, type, note, cost_center_id, created_by)
    values (p_company_id, p_date, 'saldo_awal', p_note, p_cost_center_id, auth.uid())
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

-- ----------------------------------------------------------------------------
-- 7. RPC BARU: transfer_stock_between_branches — Transfer Antar Cabang.
--    TIDAK ada dampak jurnal/keuangan (persediaan company-wide gak berubah,
--    cuma pindah lokasi) — persis prinsip di dokumen kamu.
-- ----------------------------------------------------------------------------
create or replace function transfer_stock_between_branches(
  p_company_id uuid, p_product_id uuid, p_from_cost_center_id uuid, p_to_cost_center_id uuid,
  p_qty numeric, p_date timestamptz, p_note text
) returns void as $$
declare
  v_method text;
  v_qty_on_hand numeric; v_avg_cost numeric;
  v_remaining_to_consume numeric; v_layer record; v_consume numeric;
  v_weighted_cost numeric := 0; v_total_moved_cost numeric := 0;
  v_dest_qty_before numeric; v_dest_avg_before numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat transfer stok di perusahaan ini';
  end if;
  if p_from_cost_center_id = p_to_cost_center_id then
    raise exception 'Cabang asal dan tujuan gak boleh sama';
  end if;
  if p_qty <= 0 then raise exception 'Qty transfer harus lebih dari 0'; end if;

  select inventory_method into v_method from companies where id = p_company_id;

  select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_on_hand, v_avg_cost
    from product_branch_stock where product_id = p_product_id and cost_center_id = p_from_cost_center_id for update;
  v_qty_on_hand := coalesce(v_qty_on_hand, 0);
  if v_qty_on_hand < p_qty then
    raise exception 'Stok di cabang asal gak cukup (sisa: %, diminta: %)', v_qty_on_hand, p_qty;
  end if;

  if v_method = 'average' or v_method = 'specific' then
    v_weighted_cost := v_avg_cost;
    v_total_moved_cost := p_qty * v_avg_cost;
    if v_method = 'specific' then
      v_remaining_to_consume := p_qty;
      for v_layer in
        select id, qty_remaining, unit_cost from product_stock_layers
        where product_id = p_product_id and cost_center_id = p_from_cost_center_id and qty_remaining > 0
        order by purchase_date asc, created_at asc for update
      loop
        exit when v_remaining_to_consume <= 0;
        v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
        update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
        v_remaining_to_consume := v_remaining_to_consume - v_consume;
      end loop;
    end if;
  else
    v_remaining_to_consume := p_qty;
    for v_layer in
      select id, qty_remaining, unit_cost from product_stock_layers
      where product_id = p_product_id and cost_center_id = p_from_cost_center_id and qty_remaining > 0
      order by purchase_date asc, created_at asc for update
    loop
      exit when v_remaining_to_consume <= 0;
      v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
      update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
      v_total_moved_cost := v_total_moved_cost + (v_consume * v_layer.unit_cost);
      v_remaining_to_consume := v_remaining_to_consume - v_consume;
    end loop;
    if v_remaining_to_consume > 0 then raise exception 'Stok FIFO tidak konsisten di cabang asal — hubungi admin'; end if;
    v_weighted_cost := case when p_qty > 0 then v_total_moved_cost / p_qty else 0 end;
  end if;

  insert into product_movements (company_id, product_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
    values (p_company_id, p_product_id, p_date, 'out', p_qty, v_weighted_cost, p_qty * v_weighted_cost,
      coalesce(p_note, '') || ' (Transfer keluar)', p_from_cost_center_id);
  insert into product_movements (company_id, product_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
    values (p_company_id, p_product_id, p_date, 'in', p_qty, v_weighted_cost, p_qty * v_weighted_cost,
      coalesce(p_note, '') || ' (Transfer masuk)', p_to_cost_center_id);

  if v_method != 'average' then
    insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, cost_center_id)
      values (p_company_id, p_product_id, p_date::date, p_qty, v_weighted_cost, p_to_cost_center_id);
  end if;

  perform adjust_branch_stock(p_company_id, p_product_id, p_from_cost_center_id, -p_qty, v_avg_cost);

  select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_dest_qty_before, v_dest_avg_before
    from product_branch_stock where product_id = p_product_id and cost_center_id = p_to_cost_center_id;
  v_dest_qty_before := coalesce(v_dest_qty_before, 0);
  v_dest_avg_before := coalesce(v_dest_avg_before, 0);
  perform adjust_branch_stock(p_company_id, p_product_id, p_to_cost_center_id, p_qty,
    case when (v_dest_qty_before + p_qty) > 0 then ((v_dest_qty_before * v_dest_avg_before) + (p_qty * v_weighted_cost)) / (v_dest_qty_before + p_qty) else 0 end);
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 8. RPC: get_branch_stock & get_available_layers (versi cabang)
-- ----------------------------------------------------------------------------
create or replace function get_branch_stock(p_product_id uuid, p_cost_center_id uuid)
returns numeric as $$
  select coalesce(qty_on_hand, 0) from product_branch_stock
  where product_id = p_product_id and cost_center_id = p_cost_center_id;
$$ language sql stable security invoker;

create or replace function get_available_layers(p_product_id uuid, p_cost_center_id uuid default null)
returns table (id uuid, purchase_date date, qty_remaining numeric, unit_cost numeric) as $$
  select id, purchase_date, qty_remaining, unit_cost
  from product_stock_layers
  where product_id = p_product_id and qty_remaining > 0
    and (p_cost_center_id is null or cost_center_id = p_cost_center_id)
  order by purchase_date asc, created_at asc;
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 9. Ganti record_stock_opname: WAJIB cabang juga (hitung fisik itu per lokasi).
-- ----------------------------------------------------------------------------
create or replace function record_stock_opname(
  p_company_id uuid, p_date timestamptz, p_note text, p_lines jsonb, p_cost_center_id uuid default null
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

  insert into transactions (company_id, date, type, note, cost_center_id, created_by)
    values (p_company_id, p_date, 'penyesuaian', p_note, p_cost_center_id, auth.uid())
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

-- ----------------------------------------------------------------------------
-- 10. Kartu Persediaan (v_product_card) — tambah cost_center biar bisa
--     difilter per cabang juga.
-- ----------------------------------------------------------------------------
-- PENTING: pakai DROP + CREATE (bukan CREATE OR REPLACE) karena kita nyisipin
-- kolom baru (cost_center_id, cost_center_name) DI TENGAH daftar kolom lama,
-- dan PostgreSQL gak izinin CREATE OR REPLACE VIEW mengubah urutan/nama kolom
-- yang sudah ada (cuma boleh nambah kolom baru di paling akhir).
drop view if exists v_product_card;

create view v_product_card as
select
  pm.id, pm.company_id, pm.product_id, p.code as product_code, p.name as product_name, p.unit,
  pm.cost_center_id, cc.name as cost_center_name,
  pm.date, pm.type, pm.qty, pm.unit_cost, pm.total_cost, pm.note,
  sum(case when pm.type = 'in' then pm.qty else -pm.qty end)
    over (partition by pm.product_id, pm.cost_center_id order by pm.date, pm.created_at rows between unbounded preceding and current row) as running_qty,
  sum(case when pm.type = 'in' then pm.total_cost else -pm.total_cost end)
    over (partition by pm.product_id, pm.cost_center_id order by pm.date, pm.created_at rows between unbounded preceding and current row) as running_value
from product_movements pm
join products p on p.id = pm.product_id
left join cost_centers cc on cc.id = pm.cost_center_id;

alter view v_product_card set (security_invoker = true);
