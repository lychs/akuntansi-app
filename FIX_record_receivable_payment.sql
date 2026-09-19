-- ============================================================================
-- PERBAIKAN: record_receivable_payment gagal dengan error "operator does not
-- exist: account_category = text" — soalnya kolom accounts.category itu tipe
-- ENUM account_category, sedangkan dibandingin ke v_rp.type yang di-cast ke
-- text doang (sisi kiri gak ikut di-cast). Postgres gak bisa langsung
-- membandingkan dua tipe beda gitu. Perbaikannya: cast dua-duanya ke text.
-- ============================================================================

create or replace function record_receivable_payment(
  p_receivable_payable_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_account_id uuid,
  p_note text default null
) returns uuid as $$
declare
  v_rp record;
  v_rp_account_id uuid;
  v_txn_id uuid;
  v_sisa numeric;
begin
  select * into v_rp from receivables_payables where id = p_receivable_payable_id;
  if v_rp is null then
    raise exception 'Data hutang/piutang tidak ditemukan';
  end if;
  if not is_company_editor(v_rp.company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;

  v_sisa := v_rp.amount - v_rp.paid_amount;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari 0';
  end if;
  if p_amount > v_sisa then
    raise exception 'Nominal melebihi sisa tagihan (sisa: %)', v_sisa;
  end if;

  select je.account_id into v_rp_account_id
  from journal_entries je
  join accounts a on a.id = je.account_id
  where je.transaction_id = v_rp.transaction_id and a.category::text = v_rp.type::text
  limit 1;
  if v_rp_account_id is null then
    raise exception 'Akun hutang/piutang di transaksi asal gak ditemukan';
  end if;

  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (
      v_rp.company_id, p_payment_date::timestamptz,
      case when v_rp.type = 'piutang' then 'pemasukan_sebagai_piutang'::transaction_type else 'pengeluaran_sebagai_hutang'::transaction_type end,
      coalesce(nullif(trim(p_note), ''), case when v_rp.type = 'piutang' then 'Pelunasan piutang' else 'Pelunasan hutang' end),
      v_rp.contact_id, auth.uid()
    )
    returning id into v_txn_id;

  if v_rp.type = 'piutang' then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, p_payment_account_id, p_amount, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_rp_account_id, 0, p_amount);
  else
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_rp_account_id, p_amount, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, p_payment_account_id, 0, p_amount);
  end if;

  insert into receivable_payments (receivable_payable_id, transaction_id, payment_date, amount)
    values (p_receivable_payable_id, v_txn_id, p_payment_date, p_amount);

  return v_txn_id;
end;
$$ language plpgsql security invoker;
