-- ============================================================================
-- PERBAIKAN: tabel fiscal_closings belum punya IZIN (RLS policy) buat
-- dihapus sama sekali sejak awal dibuat. Efeknya: perintah DELETE ke tabel
-- ini "sukses" tapi diam-diam gak menghapus apa-apa (0 baris), karena RLS
-- default-nya nolak semua aksi yang gak ada policy-nya secara eksplisit.
-- Ini penyebab asli kenapa "Hapus Semua Data" masih kebentur constraint
-- fiscal_closings_transaction_id_fkey walau reset_company_data-nya udah benar.
-- ============================================================================

drop policy if exists "admin can delete fiscal closings" on fiscal_closings;
create policy "admin can delete fiscal closings" on fiscal_closings
  for delete using (is_company_admin(company_id));
