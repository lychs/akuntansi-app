-- ============================================================================
-- FITUR BARU: Hapus transaksi Dagang (Pembelian/Penjualan/Retur/Stock Opname/
-- Saldo Awal/Transfer Antar Cabang) dengan PEMBALIKAN STOK yang benar —
-- sebelumnya transaksi jenis ini SAMA SEKALI GAK BISA DIHAPUS lewat web
-- (tombol Edit & Hapus digabung jadi 1 syarat yang cuma nyala buat transaksi
-- sederhana/Piutang/Hutang).
--
-- Cara kerja pembalikannya, per baris product_movements transaksi itu:
--   - Kalau baris itu tipe 'in' (nambah stok, misal Pembelian/Saldo Awal):
--     layer stok yang dibuat transaksi ini dihapus lagi (ketauan dari
--     product_stock_layers.transaction_id), lalu qty di gudang dikurangin.
--   - Kalau baris itu tipe 'out' (ngurangin stok, misal Penjualan): bikin
--     layer stok BARU dengan qty & harga pokok yang SAMA kayak yang tercatat
--     (gak bisa "balikin ke layer asli" karena datanya emang gak disimpen di
--     situ, tapi kuantitas & nilainya tetap akurat), lalu qty gudang ditambah.
--   - Cabang (cost_center) diambil per-baris — bukan dari transaksi doang —
--     biar Transfer Antar Cabang (yang nyentuh 2 cabang sekaligus) tetap
--     kebalikin bener di kedua cabangnya.
-- Setelah semua baris dibalikin, transaksinya sendiri dihapus (jurnal & baris
-- product_movements ikut kehapus otomatis lewat ON DELETE CASCADE).
-- ============================================================================

create or replace function delete_transaction_dagang(p_transaction_id uuid) returns void as $$
declare
  v_company_id uuid; v_type text;
  v_pm record;
begin
  select company_id, type into v_company_id, v_type from transactions where id = p_transaction_id;
  if v_company_id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Kamu gak punya akses buat menghapus transaksi ini';
  end if;
  if v_type not in ('pembelian_barang','penjualan_barang','retur_pembelian','retur_penjualan','saldo_awal','penyesuaian') then
    raise exception 'Jenis transaksi ini gak didukung lewat fungsi hapus khusus Dagang';
  end if;

  for v_pm in select * from product_movements where transaction_id = p_transaction_id loop
    if v_pm.type = 'in' then
      delete from product_stock_layers where transaction_id = p_transaction_id and product_id = v_pm.product_id;
      perform adjust_branch_stock(v_company_id, v_pm.product_id, v_pm.cost_center_id, -v_pm.qty, v_pm.unit_cost);
    else
      insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id)
        values (v_company_id, v_pm.product_id, v_pm.date::date, v_pm.qty, v_pm.unit_cost, null);
      perform adjust_branch_stock(v_company_id, v_pm.product_id, v_pm.cost_center_id, v_pm.qty, v_pm.unit_cost);
    end if;
  end loop;

  delete from transactions where id = p_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;
