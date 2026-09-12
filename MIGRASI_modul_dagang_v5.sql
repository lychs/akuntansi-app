-- ============================================================================
-- MIGRASI TAMBAHAN #5: Saldo Awal Persediaan
-- Buat perusahaan yang migrasi dari sistem lama dan udah punya stok jalan
-- sebelum pakai My Worksheet — bukan dicatat sebagai "pembelian" (karena gak
-- ada supplier/pembayaran beneran), tapi sebagai saldo awal yang nge-plug ke
-- akun ekuitas "Saldo Awal" (sama seperti Saldo Awal akun & Saldo Awal
-- Hutang Piutang yang udah ada).
-- Jalankan SETELAH migrasi modul Dagang (#1 dan #2).
-- ============================================================================

create or replace function record_opening_stock(
  p_company_id uuid,
  p_date timestamptz,
  p_note text,
  p_lines jsonb -- [{ "product_id": "...", "qty": 10, "unit_cost": 5000 }, ...]
) returns uuid as $$
declare
  v_txn_id uuid;
  v_inventory_account_id uuid;
  v_ob_account uuid;
  v_method text;
  v_line jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_unit_cost numeric;
  v_total numeric := 0;
  v_qty_before numeric;
  v_avg_before numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  select inventory_account_id, inventory_method into v_inventory_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'Minimal 1 baris produk';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total := v_total + (v_line->>'qty')::numeric * (v_line->>'unit_cost')::numeric;
  end loop;
  if v_total <= 0 then
    raise exception 'Total saldo awal persediaan harus lebih dari 0';
  end if;

  -- Pakai akun ekuitas "Saldo Awal" yang sama dengan fitur saldo awal akun
  -- lainnya (dibuat otomatis kalau belum ada) — bukan akun hutang/kas, karena
  -- ini cuma penyesuaian pembukuan, bukan transaksi beli beneran.
  v_ob_account := get_or_create_opening_balance_account(p_company_id);

  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_date, 'saldo_awal', p_note, auth.uid())
    returning id into v_txn_id;

  insert into journal_entries (transaction_id, account_id, debit, credit)
    values (v_txn_id, v_inventory_account_id, v_total, 0);
  insert into journal_entries (transaction_id, account_id, debit, credit)
    values (v_txn_id, v_ob_account, 0, v_total);

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_unit_cost := (v_line->>'unit_cost')::numeric;
    if v_qty <= 0 or v_unit_cost < 0 then
      raise exception 'Qty dan harga tidak valid';
    end if;

    -- Sama seperti pembelian biasa: bikin layer FIFO/Identifikasi Khusus +
    -- catatan mutasi kartu persediaan, biar konsisten dengan alur lain.
    insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id)
      values (p_company_id, v_product_id, p_date::date, v_qty, v_unit_cost, v_txn_id);
    insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
      values (p_company_id, v_product_id, v_txn_id, p_date, 'in', v_qty, v_unit_cost, v_qty * v_unit_cost, p_note);

    select qty_on_hand, avg_unit_cost into v_qty_before, v_avg_before from products where id = v_product_id;
    if v_method = 'average' then
      update products set
        avg_unit_cost = case when (v_qty_before + v_qty) > 0
          then ((v_qty_before * v_avg_before) + (v_qty * v_unit_cost)) / (v_qty_before + v_qty)
          else 0 end,
        qty_on_hand = v_qty_before + v_qty
      where id = v_product_id;
    else
      update products set qty_on_hand = v_qty_before + v_qty where id = v_product_id;
    end if;
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security definer set search_path = public;
