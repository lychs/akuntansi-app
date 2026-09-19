-- ============================================================================
-- PENYESUAIAN OTOMATIS #1: Biaya Dibayar Dimuka & Pendapatan Diterima Dimuka
-- Pola persis sama kayak Penyusutan Aset otomatis: tiap item ditangguhkan
-- bikin 1 recurring_transactions, user tinggal konfirmasi tiap bulan lewat
-- halaman Transaksi Berulang / notifikasi (SAMA kayak Penyusutan, TIDAK
-- auto-posting sendiri). Berlaku sama di Jasa, Dagang, maupun Manufaktur.
-- ============================================================================

create table if not exists deferred_items (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  type               text not null check (type in ('prepaid_expense', 'unearned_revenue')),
  name               text not null,
  total_amount       numeric not null check (total_amount > 0),
  start_date         date not null,
  month_count        int not null check (month_count > 0),
  -- prepaid_expense: balance_account = akun Harta (Biaya Dibayar Dimuka), pl_account = akun Beban
  -- unearned_revenue: balance_account = akun Hutang (Pendapatan Diterima Dimuka), pl_account = akun Pendapatan
  balance_account_id uuid not null references accounts(id),
  pl_account_id      uuid not null references accounts(id),
  is_active          boolean not null default true,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now()
);
alter table deferred_items enable row level security;

drop policy if exists "member can view deferred items" on deferred_items;
create policy "member can view deferred items" on deferred_items
  for select using (is_company_member(company_id));
drop policy if exists "editor can insert deferred items" on deferred_items;
create policy "editor can insert deferred items" on deferred_items
  for insert with check (is_company_editor(company_id));
drop policy if exists "editor can update deferred items" on deferred_items;
create policy "editor can update deferred items" on deferred_items
  for update using (is_company_editor(company_id));
drop policy if exists "editor can delete deferred items" on deferred_items;
create policy "editor can delete deferred items" on deferred_items
  for delete using (is_company_editor(company_id));

alter table recurring_transactions add column if not exists deferred_item_id uuid references deferred_items(id) on delete cascade;

create or replace function set_deferred_item(
  p_id uuid, p_company_id uuid, p_type text, p_name text, p_total_amount numeric,
  p_start_date date, p_month_count int, p_balance_account_id uuid, p_pl_account_id uuid
) returns uuid as $$
declare
  v_item_id uuid;
  v_monthly_amount numeric;
  v_recurring_id uuid;
  v_debit_account uuid;
  v_credit_account uuid;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if p_type not in ('prepaid_expense', 'unearned_revenue') then
    raise exception 'Tipe tidak valid';
  end if;

  if p_id is null then
    v_item_id := gen_random_uuid();
    insert into deferred_items (id, company_id, type, name, total_amount, start_date, month_count, balance_account_id, pl_account_id, created_by)
    values (v_item_id, p_company_id, p_type, p_name, p_total_amount, p_start_date, p_month_count, p_balance_account_id, p_pl_account_id, auth.uid());
  else
    v_item_id := p_id;
    update deferred_items set
      type = p_type, name = p_name, total_amount = p_total_amount, start_date = p_start_date,
      month_count = p_month_count, balance_account_id = p_balance_account_id, pl_account_id = p_pl_account_id
    where id = v_item_id and company_id = p_company_id;
  end if;

  -- Hapus recurring lama punya item ini (kalau ada, misal config diubah), lalu bikin ulang
  delete from recurring_transactions where deferred_item_id = v_item_id and is_system_generated = true;

  v_monthly_amount := round(p_total_amount / p_month_count);
  if v_monthly_amount <= 0 then return v_item_id; end if;

  if p_type = 'prepaid_expense' then
    v_debit_account := p_pl_account_id;       -- Beban bertambah
    v_credit_account := p_balance_account_id; -- Biaya Dibayar Dimuka berkurang
  else
    v_debit_account := p_balance_account_id;  -- Pendapatan Diterima Dimuka berkurang
    v_credit_account := p_pl_account_id;      -- Pendapatan bertambah
  end if;

  v_recurring_id := gen_random_uuid();
  insert into recurring_transactions (
    id, company_id, name, type, lines, day_of_month, use_last_day, start_date, end_date, next_run_date,
    is_system_generated, deferred_item_id, created_by
  ) values (
    v_recurring_id, p_company_id,
    (case when p_type = 'prepaid_expense' then 'Amortisasi - ' else 'Pengakuan Pendapatan - ' end) || p_name,
    'penyesuaian',
    jsonb_build_array(
      jsonb_build_object('account_id', v_debit_account, 'debit', v_monthly_amount, 'credit', 0),
      jsonb_build_object('account_id', v_credit_account, 'debit', 0, 'credit', v_monthly_amount)
    ),
    1, true, p_start_date,
    (p_start_date + (p_month_count || ' months')::interval - interval '1 day')::date,
    compute_next_recurring_date(p_start_date - 1, 1, true),
    true, v_item_id, auth.uid()
  );

  return v_item_id;
end;
$$ language plpgsql security invoker;

create or replace function delete_deferred_item(p_id uuid) returns void as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from deferred_items where id = p_id;
  if v_company_id is null then raise exception 'Item tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  delete from deferred_items where id = p_id; -- recurring_transactions ikut kehapus (cascade)
end;
$$ language plpgsql security invoker;
