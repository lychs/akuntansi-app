-- ============================================================================
-- PERBAIKAN PENTING: Fungsi create_transaction, record_purchase, record_sale,
-- record_opening_stock, record_stock_opname MENUMPUK jadi banyak versi di
-- database (tiap kali saya nambahin parameter baru lewat migrasi-migrasi
-- sebelumnya, PostgreSQL nganggep itu FUNGSI BARU yang beda, bukan gantiin
-- yang lama — karena jumlah parameternya berubah). Akibatnya PostgREST bingung
-- milih versi mana yang harus dipanggil pas ada beberapa parameter opsional
-- yang dikosongkan, munculnya error "Could not choose the best candidate
-- function...".
--
-- Migrasi ini otomatis HAPUS SEMUA versi lama fungsi-fungsi itu (apapun jumlah
-- parameternya), lalu bikin ulang cuma 1 versi final yang benar buat
-- masing-masing. Aman dijalankan kapan aja, gak akan menghapus data — cuma
-- definisi fungsi doang yang dibersihkan.
-- ============================================================================

do $$
declare
  r record;
  fn text;
begin
  foreach fn in array array['create_transaction','record_purchase','record_sale','record_opening_stock','record_stock_opname'] loop
    for r in
      select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute format('drop function if exists %s', r.sig);
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Bikin ulang versi final create_transaction (13 parameter, yang paling baru).
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

-- ----------------------------------------------------------------------------
-- Bikin ulang versi final record_purchase.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Bikin ulang versi final record_sale.
-- ----------------------------------------------------------------------------
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
-- Bikin ulang versi final record_opening_stock.
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

-- ----------------------------------------------------------------------------
-- Bikin ulang versi final record_stock_opname.
-- ----------------------------------------------------------------------------
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
