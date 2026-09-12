-- ============================================================================
-- MIGRASI BARU: RPC reset_company_data
-- Jalankan SQL ini di Supabase → SQL Editor → New Query → paste → Run.
-- Aman dijalankan berkali-kali (pakai "create or replace function").
--
-- Fungsi ini menghapus SEMUA data transaksional & master data suatu perusahaan
-- (transaksi, jurnal, akun/COA, kontak, aset, hutang piutang, riwayat tutup buku)
-- TAPI TIDAK menghapus baris company itu sendiri ataupun daftar anggota tim
-- (company_users) — supaya perusahaan & akses anggota tetap ada, cuma datanya
-- yang bersih kembali.
--
-- Hanya bisa dijalankan oleh admin (Owner) perusahaan tsb — dicek via
-- is_company_admin() yang sudah ada dari migrasi sebelumnya.
-- ============================================================================

create or replace function reset_company_data(p_company_id uuid)
returns void as $$
begin
  if not is_company_admin(p_company_id) then
    raise exception 'Cuma Owner yang bisa menghapus semua data perusahaan';
  end if;

  -- Urutan penghapusan mengikuti arah foreign key (child dulu baru parent)
  -- supaya gak kena constraint violation.

  -- 1. Pembayaran piutang/hutang (child dari receivables_payables & transactions)
  delete from receivable_payments
    where receivable_payable_id in (
      select id from receivables_payables where company_id = p_company_id
    );

  -- 2. Baris hutang piutang (child dari transactions & contacts)
  delete from receivables_payables where company_id = p_company_id;

  -- 3. Riwayat tutup buku (child dari transactions)
  delete from fiscal_closings where company_id = p_company_id;

  -- 4. Jurnal (child dari transactions & accounts) — sebenarnya sudah auto-cascade
  --    kalau transactions dihapus (on delete cascade), tapi dihapus eksplisit dulu
  --    di sini biar urutannya jelas dan gak bergantung asumsi cascade.
  delete from journal_entries
    where transaction_id in (
      select id from transactions where company_id = p_company_id
    );

  -- 5. Transaksi (parent dari journal_entries, sudah gak direferensikan lagi
  --    oleh receivables_payables/fiscal_closings karena sudah dihapus di atas)
  delete from transactions where company_id = p_company_id;

  -- 6. Aset (child dari accounts)
  delete from assets where company_id = p_company_id;

  -- 7. Akun / COA
  delete from accounts where company_id = p_company_id;

  -- 8. Kontak
  delete from contacts where company_id = p_company_id;
end;
$$ language plpgsql security invoker;
