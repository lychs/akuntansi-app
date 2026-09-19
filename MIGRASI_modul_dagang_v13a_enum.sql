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
