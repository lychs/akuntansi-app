-- ============================================================================
-- RPC baru: khusus buat catatan Hutang/Piutang yang asalnya dari Pembelian
-- Barang / Penjualan Barang (bukan dari transaksi Hutang/Piutang biasa).
-- Cuma boleh ubah Tanggal Jatuh Tempo & No. Invoice — SENGAJA gak boleh ubah
-- nominal, kontak, atau akun jurnal, karena transaksi Dagang itu juga punya
-- data stok (FIFO/Average) yang nyambung ke jurnalnya. Kalau nominalnya
-- diubah sembarangan lewat sini, stok & jurnal bisa gak sinkron.
-- ============================================================================

create or replace function update_receivable_payable_dagang_metadata(
  p_id uuid, p_due_date date, p_invoice_no text
) returns void as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from receivables_payables where id = p_id;
  if v_company_id is null then raise exception 'Data tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini';
  end if;

  update receivables_payables
    set due_date = p_due_date, invoice_no = p_invoice_no
    where id = p_id;
end;
$$ language plpgsql security invoker;
