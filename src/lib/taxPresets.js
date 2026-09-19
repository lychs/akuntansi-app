// Preset jenis pajak Indonesia yang umum dipakai — dipakai bareng di form
// Tambah Transaksi (Pemasukan/Pengeluaran) dan di Edit Transaksi Piutang/Hutang.
// "direction: withhold" = pajak dipotong dari nominal transaksi (customer/kita
// yang motong sebelum bayar). "direction: add" = pajak ditambahkan di atas
// nominal transaksi (misal PPN).
export const TAX_PRESETS = [
  { key: 'ppn', label: 'PPN (11%)', pct: 11, direction: 'add' },
  { key: 'pph21', label: 'PPh 21 (Karyawan)', pct: 5, direction: 'withhold' },
  { key: 'pph22', label: 'PPh 22', pct: 1.5, direction: 'withhold' },
  { key: 'pph23_jasa', label: 'PPh 23 — Jasa (2%)', pct: 2, direction: 'withhold' },
  { key: 'pph23_lain', label: 'PPh 23 — Dividen/Bunga/Royalti (15%)', pct: 15, direction: 'withhold' },
  { key: 'pph25', label: 'PPh 25 (Angsuran)', pct: 0, direction: 'add' },
  { key: 'pph26', label: 'PPh 26 (Non-Resident, 20%)', pct: 20, direction: 'withhold' },
  { key: 'pph_final_umkm', label: 'PPh Final UMKM (0,5%)', pct: 0.5, direction: 'withhold' },
  { key: 'pph_final_sewa', label: 'PPh Final — Sewa Tanah/Bangunan (10%)', pct: 10, direction: 'withhold' },
  { key: 'pph_final_konstruksi', label: 'PPh Final — Jasa Konstruksi', pct: 3, direction: 'withhold' },
  { key: 'custom', label: 'Custom / Lainnya', pct: 0, direction: 'add' },
]
