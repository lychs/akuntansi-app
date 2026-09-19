-- ============================================================================
-- FITUR BARU: Hapus transaksi "Pemasukan sebagai Piutang" / "Pengeluaran
-- sebagai Hutang" — ini transaksi OTOMATIS yang dibikin pas kamu klik
-- "Bayar/Lunasi" di Laporan Hutang Piutang. Sebelumnya SAMA SEKALI gak ada
-- cara buat koreksi kalau salah catat pembayaran (nominal salah, dsb).
--
-- Cara kerjanya: cari baris di tabel receivable_payments yang nyambung ke
-- transaksi ini, hapus baris itu, hitung ULANG paid_amount di
-- receivables_payables berdasarkan SISA pembayaran yang masih ada (bukan
-- cuma dikurangin — dihitung ulang dari nol biar akurat walau ada trigger
-- lain yang mungkin udah jalan), baru transaksinya sendiri dihapus.
-- ============================================================================

create or replace function delete_receivable_payment(p_transaction_id uuid) returns void as $$
declare
  v_company_id uuid; v_type text;
  v_rp_id uuid;
begin
  select company_id, type into v_company_id, v_type from transactions where id = p_transaction_id;
  if v_company_id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if v_type not in ('pemasukan_sebagai_piutang', 'pengeluaran_sebagai_hutang') then
    raise exception 'Jenis transaksi ini gak didukung lewat fungsi hapus pembayaran';
  end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Kamu gak punya akses buat menghapus transaksi ini';
  end if;

  select receivable_payable_id into v_rp_id from receivable_payments where transaction_id = p_transaction_id;
  if v_rp_id is null then raise exception 'Data pembayaran terkait tidak ditemukan'; end if;

  delete from receivable_payments where transaction_id = p_transaction_id;

  update receivables_payables
    set paid_amount = coalesce((select sum(amount) from receivable_payments where receivable_payable_id = v_rp_id), 0)
    where id = v_rp_id;

  delete from transactions where id = p_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;
