-- ============================================================================
-- PERBAIKAN: Laporan Rekap Pembelian & Penjualan nampilin "Nilai Terjual"
-- pakai HARGA MODAL (HPP) barang, bukan HARGA JUAL sebenarnya — soalnya nilai
-- jual per produk itu SEBELUMNYA GAK PERNAH DISIMPAN sama sekali (cuma
-- dipakai sekali pas hitung total jurnal, terus dibuang).
--
-- Perbaikan ini nambah 1 kolom baru (revenue_amount) di product_movements,
-- lalu nulis ulang record_sale supaya nyimpen nilai jual asli per baris
-- (TANPA ngubah logika FIFO/Average/Specific-nya sama sekali — cuma nambah
-- 1 angka ke tiap INSERT yang udah ada).
-- ============================================================================

alter table product_movements add column if not exists revenue_amount numeric;

-- ----------------------------------------------------------------------------
-- record_sale — sama persis kayak versi sebelumnya, CUMA nambah kolom
-- revenue_amount di tiap insert product_movements. Buat baris FIFO yang bisa
-- kepecah ke beberapa layer/batch, nilai jualnya diproporsiin sesuai qty yang
-- kekonsumsi dari layer itu (v_consume), bukan dari qty keseluruhan baris.
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
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id, revenue_amount)
        values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_avg_cost, v_line_cogs, p_note, p_cost_center_id, v_qty * v_sale_price);
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
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id, revenue_amount)
        values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_layer_cost, v_line_cogs, p_note, p_cost_center_id, v_qty * v_sale_price);
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
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id, revenue_amount)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note, p_cost_center_id, v_consume * v_sale_price);
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
-- get_purchase_sales_recap — "Nilai Terjual" sekarang pakai revenue_amount
-- (nilai jual asli), bukan total_cost (nilai modal) lagi.
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
    coalesce(sum(case when t.type = 'penjualan_barang' then coalesce(pm.revenue_amount, pm.total_cost) else 0 end), 0),
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

-- ============================================================================
-- CATATAN: transaksi Penjualan Barang yang UDAH ADA sebelum perbaikan ini
-- gak punya revenue_amount (masih NULL) — otomatis fallback ke total_cost
-- lewat "coalesce" di atas, jadi tetap tampil, tapi masih pakai nilai modal
-- (bukan nilai jual asli) buat data lama itu. Kalau mau data historisnya
-- akurat juga, hitung manual nilai jual asli transaksi lama itu terus
-- jalanin (cari transaction_id-nya di Laporan Transaksi):
--
-- update product_movements set revenue_amount = <nilai jual yang benar>
-- where transaction_id = '<id transaksi penjualan lama>' and product_id = '<id produk>';
-- ============================================================================
