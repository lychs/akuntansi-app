-- ============================================================================
-- PERBAIKAN: Tabel "fiscal_closings" (buat fitur Tutup Buku) ternyata belum
-- pernah ada di database ini — makanya "Hapus Semua Data" (dan sebenarnya
-- fitur Tutup Buku itu sendiri) gagal dengan error "relation fiscal_closings
-- does not exist". Migrasi ini aman dijalankan kapan saja, gak akan
-- menghapus/mengubah data yang sudah ada.
-- ============================================================================

create table if not exists fiscal_closings (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  closing_date   date not null,
  net_income     numeric(18,2) not null,
  transaction_id uuid not null references transactions(id),
  note           text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (company_id, closing_date)
);
alter table fiscal_closings enable row level security;

drop policy if exists "member can view fiscal closings" on fiscal_closings;
create policy "member can view fiscal closings" on fiscal_closings
  for select using (is_company_member(company_id));
drop policy if exists "admin can insert fiscal closings" on fiscal_closings;
create policy "admin can insert fiscal closings" on fiscal_closings
  for insert with check (
    exists (select 1 from company_users where company_id = fiscal_closings.company_id and user_id = auth.uid() and role = 'admin')
  );

-- Kunci: gak boleh input transaksi baru di tanggal yang udah "ditutup buku"-nya.
create or replace function prevent_transaction_before_closing() returns trigger as $$
declare
  v_last_closing date;
begin
  select max(closing_date) into v_last_closing from fiscal_closings where company_id = new.company_id;
  if v_last_closing is not null and new.date::date <= v_last_closing then
    raise exception 'Tanggal % sudah ditutup buku (tutup buku terakhir: %). Gak bisa input transaksi baru di periode yang sudah ditutup.',
      new.date::date, v_last_closing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_prevent_transaction_before_closing on transactions;
create trigger trg_prevent_transaction_before_closing
  before insert on transactions
  for each row execute function prevent_transaction_before_closing();

-- RPC utama: proses tutup buku. Nolkan semua akun Pendapatan/Beban periode berjalan,
-- pindahkan selisihnya (laba/rugi bersih) ke akun "Laba Ditahan".
create or replace function close_fiscal_year(p_company_id uuid, p_closing_date date, p_note text default null) returns uuid as $$
declare
  v_last_closing date;
  v_start date;
  v_txn_id uuid;
  v_retained_account uuid;
  v_net_income numeric := 0;
  v_amt numeric;
  v_row record;
begin
  if not is_company_admin(p_company_id) then
    raise exception 'Cuma admin yang bisa melakukan tutup buku';
  end if;

  select max(closing_date) into v_last_closing from fiscal_closings where company_id = p_company_id;
  if v_last_closing is not null and p_closing_date <= v_last_closing then
    raise exception 'Tanggal tutup buku harus setelah tutup buku terakhir (%)', v_last_closing;
  end if;
  v_start := coalesce(v_last_closing + 1, '1900-01-01'::date);

  select id into v_retained_account from accounts where company_id = p_company_id and code = '3-30098';
  if v_retained_account is null then
    insert into accounts (company_id, code, name, category, normal_balance, is_locked, description)
    values (p_company_id, '3-30098', 'Laba Ditahan', 'modal', 'kredit', true,
            'Akumulasi laba/rugi dari periode yang sudah ditutup buku')
    returning id into v_retained_account;
  end if;

  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_closing_date, 'penyesuaian', coalesce(p_note, 'Tutup Buku Akhir Periode'), auth.uid())
    returning id into v_txn_id;

  for v_row in
    select a.id, a.normal_balance,
      coalesce(sum(je.debit),0) as total_debit, coalesce(sum(je.credit),0) as total_credit
    from accounts a
    left join journal_entries je on je.account_id = a.id
    left join transactions t on t.id = je.transaction_id and t.date >= v_start and t.date <= p_closing_date
    where a.company_id = p_company_id and a.category in ('pendapatan','beban_pokok','beban_operasional')
    group by a.id, a.normal_balance
    having coalesce(sum(je.debit),0) <> 0 or coalesce(sum(je.credit),0) <> 0
  loop
    if v_row.normal_balance = 'kredit' then
      v_amt := v_row.total_credit - v_row.total_debit;
      if v_amt > 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, v_amt, 0);
      elsif v_amt < 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, 0, -v_amt);
      end if;
      v_net_income := v_net_income + v_amt;
    else
      v_amt := v_row.total_debit - v_row.total_credit;
      if v_amt > 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, 0, v_amt);
      elsif v_amt < 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, -v_amt, 0);
      end if;
      v_net_income := v_net_income - v_amt;
    end if;
  end loop;

  if v_net_income > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_retained_account, 0, v_net_income);
  elsif v_net_income < 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_retained_account, -v_net_income, 0);
  end if;

  insert into fiscal_closings (company_id, closing_date, net_income, transaction_id, note, created_by)
    values (p_company_id, p_closing_date, v_net_income, v_txn_id, p_note, auth.uid());

  return v_txn_id;
end;
$$ language plpgsql security invoker set search_path = public;
