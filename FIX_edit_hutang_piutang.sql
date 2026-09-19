-- ============================================================================
-- FITUR BARU: Edit Transaksi Piutang/Hutang — termasuk nambah baris pajak
-- (akun ke-3) di jurnalnya, sesuai kebutuhan riil di lapangan (PPN/PPh yang
-- motong atau nambah nominal piutang/hutang).
--
-- Nominal piutang/hutang yang tercatat di Laporan Hutang Piutang otomatis
-- dihitung ulang dari baris jurnal yang nyentuh akun kategori piutang/hutang
-- (bisa lebih dari 1 baris kalau ada penyesuaian pajak). Ada penjagaan: gak
-- boleh diubah jadi lebih kecil dari yang udah kadung dibayar.
-- ============================================================================

create or replace function update_transaction_hutang_piutang(
  p_transaction_id uuid, p_date timestamptz, p_note text, p_contact_id uuid,
  p_due_date date, p_invoice_no text, p_lines jsonb
) returns void as $$
declare
  v_company_id uuid;
  v_type transaction_type;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_new_rp_amount numeric := 0;
  v_rp_id uuid;
  v_paid_amount numeric;
  v_category text;
begin
  select company_id, type into v_company_id, v_type from transactions where id = p_transaction_id;
  if v_company_id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if v_type not in ('piutang','hutang') then
    raise exception 'Fungsi ini cuma buat transaksi Piutang/Hutang';
  end if;
  if exists (select 1 from fiscal_closings where company_id = v_company_id and closing_date >= p_date::date) then
    raise exception 'Tanggal ini sudah masuk periode yang ditutup buku — gak bisa diedit';
  end if;
  if p_contact_id is null then
    raise exception 'Transaksi Hutang/Piutang wajib pilih kontak';
  end if;

  select id, paid_amount into v_rp_id, v_paid_amount from receivables_payables where transaction_id = p_transaction_id;
  if v_rp_id is null then raise exception 'Data hutang/piutang terkait gak ditemukan'; end if;

  update transactions set date = p_date, note = p_note, contact_id = p_contact_id where id = p_transaction_id;
  delete from journal_entries where transaction_id = p_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (p_transaction_id, v_account_id, v_debit, v_credit);

    select category::text into v_category from accounts where id = v_account_id;
    if v_type = 'piutang' and v_category = 'piutang' and v_debit > 0 then
      v_new_rp_amount := v_new_rp_amount + v_debit;
    elsif v_type = 'hutang' and v_category = 'hutang' and v_credit > 0 then
      v_new_rp_amount := v_new_rp_amount + v_credit;
    end if;
  end loop;

  if v_new_rp_amount <= 0 then
    raise exception 'Minimal harus ada 1 baris yang menyentuh akun kategori %', case when v_type = 'piutang' then 'Piutang' else 'Hutang' end;
  end if;
  if v_new_rp_amount < v_paid_amount then
    raise exception 'Nominal baru (%) gak boleh lebih kecil dari yang udah dibayar (%)', v_new_rp_amount, v_paid_amount;
  end if;

  update receivables_payables
    set amount = v_new_rp_amount, due_date = p_due_date, invoice_no = p_invoice_no
    where id = v_rp_id;
end;
$$ language plpgsql security invoker;

-- RPC: hapus transaksi Piutang/Hutang — ditolak kalau udah ada pembayaran
-- (biar gak nyisain baris receivable_payments yang nyantol/nyasar).
create or replace function delete_transaction_hutang_piutang(p_transaction_id uuid) returns void as $$
declare
  v_company_id uuid;
  v_type transaction_type;
  v_rp_id uuid;
  v_paid_amount numeric;
begin
  select company_id, type into v_company_id, v_type from transactions where id = p_transaction_id;
  if v_company_id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if v_type not in ('piutang','hutang') then
    raise exception 'Fungsi ini cuma buat transaksi Piutang/Hutang';
  end if;

  select id, paid_amount into v_rp_id, v_paid_amount from receivables_payables where transaction_id = p_transaction_id;
  if v_paid_amount > 0 then
    raise exception 'Gak bisa dihapus — transaksi ini udah ada pembayarannya (sudah dibayar: %). Hapus dulu riwayat pembayarannya kalau memang perlu.', v_paid_amount;
  end if;

  delete from receivables_payables where id = v_rp_id;
  delete from transactions where id = p_transaction_id;
end;
$$ language plpgsql security invoker;
