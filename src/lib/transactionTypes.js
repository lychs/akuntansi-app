// Mapping jenis transaksi -> label & filter kategori akun untuk sisi Debit/Kredit.
// Cocok dengan tabel "Logic Inti" di dokumen rancangan (Rancangan_Software_Akuntansi.md #4).
// categoryFilter: null artinya semua kategori akun boleh dipilih (dropdown tidak difilter).
// Label di sini berupa translation KEY (bukan teks langsung) — resolusi ke teks aktual
// dilakukan di komponen yang memakainya lewat t(`transactionTypes.${key}`), supaya
// mengikuti bahasa UI yang aktif.
export const TRANSACTION_TYPES = [
  {
    value: 'general',
    labelKey: 'general',
    debitLabelKey: 'debit',
    creditLabelKey: 'credit',
    debitCategoryFilter: null,
    creditCategoryFilter: null,
  },
  {
    value: 'pemasukan',
    labelKey: 'pemasukan',
    debitLabelKey: 'masukKeDebit',
    creditLabelKey: 'sebagaiKredit',
    debitCategoryFilter: ['kas_bank'],
    creditCategoryFilter: ['pendapatan'],
  },
  {
    value: 'pengeluaran',
    labelKey: 'pengeluaran',
    debitLabelKey: 'untukBiayaDebit',
    creditLabelKey: 'diambilDariKredit',
    debitCategoryFilter: ['beban_pokok', 'beban_operasional'],
    creditCategoryFilter: ['kas_bank'],
  },
  {
    value: 'hutang',
    labelKey: 'hutang',
    debitLabelKey: 'untukDebit',
    creditLabelKey: 'hutangKeKredit',
    debitCategoryFilter: ['beban_pokok', 'beban_operasional', 'harta_tetap', 'persediaan'],
    creditCategoryFilter: ['hutang'],
  },
  {
    value: 'piutang',
    labelKey: 'piutang',
    debitLabelKey: 'piutangDebit',
    creditLabelKey: 'sebagaiKredit',
    debitCategoryFilter: ['piutang'],
    creditCategoryFilter: ['pendapatan'],
  },
  {
    value: 'tanam_modal',
    labelKey: 'tanam_modal',
    debitLabelKey: 'masukKeDebit',
    creditLabelKey: 'modalKredit',
    debitCategoryFilter: ['kas_bank'],
    creditCategoryFilter: ['modal'],
  },
  {
    value: 'tarik_modal',
    labelKey: 'tarik_modal',
    debitLabelKey: 'modalDebit',
    creditLabelKey: 'diambilDariKredit',
    debitCategoryFilter: ['modal'],
    creditCategoryFilter: ['kas_bank'],
  },
  {
    value: 'transfer',
    labelKey: 'transfer',
    debitLabelKey: 'keAkunDebit',
    creditLabelKey: 'dariAkunKredit',
    debitCategoryFilter: ['kas_bank'],
    creditCategoryFilter: ['kas_bank'],
  },
  {
    value: 'penyesuaian',
    labelKey: 'penyesuaian',
    debitLabelKey: 'debit',
    creditLabelKey: 'credit',
    debitCategoryFilter: null,
    creditCategoryFilter: null,
  },
]

export function getTypeConfig(value) {
  return TRANSACTION_TYPES.find((t) => t.value === value) || TRANSACTION_TYPES[0]
}
