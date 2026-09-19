-- ============================================================================
-- PERBAIKAN BESAR: Pembelian Barang & Penjualan Barang ternyata TIDAK PERNAH
-- bikin catatan di sistem pelacakan Hutang Piutang, walaupun kamu pilih akun
-- kategori Hutang/Piutang sebagai akun pembayarannya — dia cuma bikin jurnal
-- biasa. Makanya Laporan Hutang Piutang kosong.
--
-- Perbaikan ini pakai TRIGGER (bukan nulis ulang record_purchase/record_sale
-- dari nol — itu berisiko ngerusak logika FIFO/Average yang udah jalan baik).
-- Triggernya otomatis ngecek tiap kali ada baris jurnal baru: kalau itu dari
-- transaksi Pembelian/Penjualan Barang DAN nyentuh akun berkategori
-- Hutang/Piutang, otomatis bikinin catatan Hutang Piutang-nya juga.
--
-- Catatan: due_date & no. invoice awalnya kosong (karena form Pembelian/
-- Penjualan Barang belum ada kolom itu) — tapi bisa diisi belakangan lewat
-- tombol Edit di halaman Laporan Hutang Piutang.
-- ============================================================================

create or replace function auto_create_receivable_payable_for_dagang() returns trigger as $$
declare
  v_txn record;
  v_category text;
begin
  select id, company_id, contact_id, type, date, cost_center_id, department_id, project_id, warehouse_id
    into v_txn from transactions where id = new.transaction_id;

  if v_txn.type not in ('pembelian_barang', 'penjualan_barang') then
    return new;
  end if;

  select category into v_category from accounts where id = new.account_id;

  if v_txn.type = 'pembelian_barang' and v_category = 'hutang' and new.credit > 0 and v_txn.contact_id is not null then
    if not exists (select 1 from receivables_payables where transaction_id = v_txn.id) then
      insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id, department_id, project_id, warehouse_id)
        values (v_txn.company_id, v_txn.id, v_txn.contact_id, 'hutang'::receivable_payable_type, null, v_txn.date::date, null, new.credit, v_txn.cost_center_id, v_txn.department_id, v_txn.project_id, v_txn.warehouse_id);
    end if;
  elsif v_txn.type = 'penjualan_barang' and v_category = 'piutang' and new.debit > 0 and v_txn.contact_id is not null then
    if not exists (select 1 from receivables_payables where transaction_id = v_txn.id) then
      insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id, department_id, project_id, warehouse_id)
        values (v_txn.company_id, v_txn.id, v_txn.contact_id, 'piutang'::receivable_payable_type, null, v_txn.date::date, null, new.debit, v_txn.cost_center_id, v_txn.department_id, v_txn.project_id, v_txn.warehouse_id);
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_rp_dagang on journal_entries;
create trigger trg_auto_rp_dagang
  after insert on journal_entries
  for each row execute function auto_create_receivable_payable_for_dagang();

-- ============================================================================
-- TAMBALAN SEKALI JALAN: trigger di atas cuma berlaku buat transaksi BARU
-- setelah ini. Query di bawah nyari transaksi Pembelian/Penjualan Barang yang
-- SUDAH ADA sebelumnya, yang nyentuh akun Hutang/Piutang tapi belum punya
-- catatan di receivables_payables, terus bikinin catatannya sekarang juga.
-- ============================================================================

insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id, department_id, project_id, warehouse_id)
select t.company_id, t.id, t.contact_id, 'hutang'::receivable_payable_type, null, t.date::date, null, je.credit, t.cost_center_id, t.department_id, t.project_id, t.warehouse_id
from transactions t
join journal_entries je on je.transaction_id = t.id
join accounts a on a.id = je.account_id
where t.type = 'pembelian_barang' and a.category = 'hutang' and je.credit > 0 and t.contact_id is not null
  and not exists (select 1 from receivables_payables rp where rp.transaction_id = t.id);

insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id, department_id, project_id, warehouse_id)
select t.company_id, t.id, t.contact_id, 'piutang'::receivable_payable_type, null, t.date::date, null, je.debit, t.cost_center_id, t.department_id, t.project_id, t.warehouse_id
from transactions t
join journal_entries je on je.transaction_id = t.id
join accounts a on a.id = je.account_id
where t.type = 'penjualan_barang' and a.category = 'piutang' and je.debit > 0 and t.contact_id is not null
  and not exists (select 1 from receivables_payables rp where rp.transaction_id = t.id);
