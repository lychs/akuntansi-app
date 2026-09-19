-- ============================================================================
-- FITUR BARU: Transaksi Berulang (Recurring) — dipakai buat transaksi rutin
-- apapun (sewa bulanan, langganan, gaji tetap, dll) DAN sekaligus jadi mesin
-- buat posting Beban Penyusutan otomatis tiap bulan (yang sebelumnya cuma
-- dihitung buat tampilan doang, gak pernah beneran nyatet jurnal).
-- ============================================================================

create table if not exists recurring_transactions (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  name               text not null,
  type               transaction_type not null default 'general',
  lines              jsonb not null, -- [{account_id, debit, credit}]
  contact_id         uuid references contacts(id),
  cost_center_id     uuid references cost_centers(id),
  department_id      uuid references departments(id),
  project_id         uuid references projects(id),
  warehouse_id       uuid references warehouses(id),
  day_of_month       int not null default 1 check (day_of_month between 1 and 31),
  use_last_day       boolean not null default false, -- true = selalu tanggal terakhir bulan itu
  start_date         date not null,
  end_date           date, -- null = gak ada batas akhir
  next_run_date      date not null,
  last_run_date      date,
  is_active          boolean not null default true,
  is_system_generated boolean not null default false, -- true buat yang auto-dibikin dari Aset (penyusutan)
  asset_id           uuid references assets(id) on delete cascade,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now()
);
alter table recurring_transactions enable row level security;

drop policy if exists "member can view recurring transactions" on recurring_transactions;
create policy "member can view recurring transactions" on recurring_transactions
  for select using (is_company_member(company_id));
drop policy if exists "editor can insert recurring transactions" on recurring_transactions;
create policy "editor can insert recurring transactions" on recurring_transactions
  for insert with check (is_company_editor(company_id));
drop policy if exists "editor can update recurring transactions" on recurring_transactions;
create policy "editor can update recurring transactions" on recurring_transactions
  for update using (is_company_editor(company_id));
drop policy if exists "editor can delete recurring transactions" on recurring_transactions;
create policy "editor can delete recurring transactions" on recurring_transactions
  for delete using (is_company_editor(company_id));

-- Tabel kecil buat nyatet histori tiap kali recurring itu "dijalankan"
-- (biar keliatan riwayatnya, dan biar gampang nelusur transaksi mana yang
-- lahir dari recurring mana).
create table if not exists recurring_transaction_runs (
  id                     uuid primary key default gen_random_uuid(),
  recurring_id           uuid not null references recurring_transactions(id) on delete cascade,
  transaction_id         uuid not null references transactions(id) on delete cascade,
  run_date               date not null,
  created_at             timestamptz not null default now()
);
alter table recurring_transaction_runs enable row level security;
drop policy if exists "member can view recurring runs" on recurring_transaction_runs;
create policy "member can view recurring runs" on recurring_transaction_runs
  for select using (
    exists (select 1 from recurring_transactions rt where rt.id = recurring_id and is_company_member(rt.company_id))
  );

-- ----------------------------------------------------------------------------
-- Helper: hitung next_run_date berikutnya dari sebuah tanggal acuan.
-- ----------------------------------------------------------------------------
create or replace function compute_next_recurring_date(p_from date, p_day_of_month int, p_use_last_day boolean)
returns date as $$
declare
  v_year int; v_month int; v_candidate date; v_last_day date;
begin
  v_year := extract(year from p_from);
  v_month := extract(month from p_from);
  v_last_day := (date_trunc('month', p_from) + interval '1 month - 1 day')::date;
  if p_use_last_day then
    v_candidate := v_last_day;
  else
    v_candidate := least(make_date(v_year, v_month, 1) + (p_day_of_month - 1), v_last_day);
  end if;
  if v_candidate <= p_from then
    -- udah lewat bulan ini, majuin ke bulan depan
    v_last_day := (date_trunc('month', p_from) + interval '2 month - 1 day')::date;
    if p_use_last_day then
      v_candidate := v_last_day;
    else
      v_candidate := least((date_trunc('month', p_from) + interval '1 month')::date + (p_day_of_month - 1), v_last_day);
    end if;
  end if;
  return v_candidate;
end;
$$ language plpgsql immutable;

-- ----------------------------------------------------------------------------
-- RPC: get_due_recurring_transactions — daftar recurring yang udah "jatuh
-- tempo" buat dijalankan (next_run_date <= hari ini), dipakai buat notifikasi.
-- ----------------------------------------------------------------------------
create or replace function get_due_recurring_transactions(p_company_id uuid)
returns table (
  id uuid, name text, type text, next_run_date date, amount numeric, is_system_generated boolean
) as $$
  select rt.id, rt.name, rt.type::text, rt.next_run_date,
    (select coalesce(sum((l->>'debit')::numeric), 0) from jsonb_array_elements(rt.lines) l),
    rt.is_system_generated
  from recurring_transactions rt
  where rt.company_id = p_company_id and rt.is_active = true and rt.next_run_date <= current_date
  order by rt.next_run_date;
$$ language sql stable security invoker;

-- ----------------------------------------------------------------------------
-- RPC: run_recurring_transaction — eksekusi 1 recurring: bikin transaksi
-- beneran, catat histori, majuin next_run_date.
-- ----------------------------------------------------------------------------
create or replace function run_recurring_transaction(p_recurring_id uuid) returns uuid as $$
declare
  v_rt record;
  v_txn_id uuid;
begin
  select * into v_rt from recurring_transactions where id = p_recurring_id;
  if v_rt is null then raise exception 'Recurring transaksi tidak ditemukan'; end if;
  if not is_company_editor(v_rt.company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if v_rt.end_date is not null and v_rt.next_run_date > v_rt.end_date then
    raise exception 'Recurring ini udah lewat tanggal berakhirnya';
  end if;

  v_txn_id := create_transaction(
    p_company_id := v_rt.company_id,
    p_date := v_rt.next_run_date::timestamptz,
    p_type := v_rt.type,
    p_note := v_rt.name || ' (' || to_char(v_rt.next_run_date, 'Mon YYYY') || ')',
    p_contact_id := v_rt.contact_id,
    p_lines := v_rt.lines,
    p_cost_center_id := v_rt.cost_center_id,
    p_department_id := v_rt.department_id,
    p_project_id := v_rt.project_id,
    p_warehouse_id := v_rt.warehouse_id
  );

  insert into recurring_transaction_runs (recurring_id, transaction_id, run_date) values (p_recurring_id, v_txn_id, v_rt.next_run_date);

  update recurring_transactions
    set last_run_date = v_rt.next_run_date,
        next_run_date = compute_next_recurring_date(v_rt.next_run_date, v_rt.day_of_month, v_rt.use_last_day),
        is_active = case when v_rt.end_date is not null and compute_next_recurring_date(v_rt.next_run_date, v_rt.day_of_month, v_rt.use_last_day) > v_rt.end_date then false else is_active end
    where id = p_recurring_id;

  return v_txn_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- RPC: run_all_due_recurring — jalankan SEMUA yang jatuh tempo sekaligus
-- (dipakai tombol "Proses Semua" di notifikasi/halaman recurring).
-- ----------------------------------------------------------------------------
create or replace function run_all_due_recurring(p_company_id uuid) returns int as $$
declare
  v_rec record;
  v_count int := 0;
begin
  for v_rec in
    select id from recurring_transactions
    where company_id = p_company_id and is_active = true and next_run_date <= current_date
    order by next_run_date
  loop
    perform run_recurring_transaction(v_rec.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- Penyusutan otomatis: kolom tambahan di assets buat nyimpen akun Beban
-- Penyusutan & Akumulasi Penyusutan yang dipilih, plus RPC buat bikin/update
-- recurring transaction dari config penyusutan aset.
-- ----------------------------------------------------------------------------
alter table assets add column if not exists depreciation_expense_account_id uuid references accounts(id);
alter table assets add column if not exists accumulated_depreciation_account_id uuid references accounts(id);

create or replace function set_asset_depreciation(
  p_asset_id uuid, p_depreciation_start_date date, p_useful_life_months int, p_salvage_value numeric,
  p_expense_account_id uuid, p_accumulated_account_id uuid
) returns void as $$
declare
  v_asset record;
  v_monthly_amount numeric;
  v_recurring_id uuid;
begin
  select * into v_asset from assets where id = p_asset_id;
  if v_asset is null then raise exception 'Aset tidak ditemukan'; end if;
  if not is_company_editor(v_asset.company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;

  update assets set
    depreciation_start_date = p_depreciation_start_date,
    useful_life_months = p_useful_life_months,
    salvage_value = p_salvage_value,
    depreciation_expense_account_id = p_expense_account_id,
    accumulated_depreciation_account_id = p_accumulated_account_id
  where id = p_asset_id;

  -- Hapus dulu recurring lama punya aset ini (kalau ada, misal config diubah)
  delete from recurring_transactions where asset_id = p_asset_id and is_system_generated = true;

  if p_depreciation_start_date is null or p_useful_life_months is null or p_useful_life_months <= 0 then
    return; -- config dikosongin, gak bikin recurring
  end if;
  if p_expense_account_id is null or p_accumulated_account_id is null then
    raise exception 'Pilih akun Beban Penyusutan dan Akumulasi Penyusutan dulu buat mengaktifkan penyusutan otomatis';
  end if;

  v_monthly_amount := round((v_asset.acquisition_cost - coalesce(p_salvage_value, 0)) / p_useful_life_months);
  if v_monthly_amount <= 0 then return; end if;

  v_recurring_id := gen_random_uuid();
  insert into recurring_transactions (
    id, company_id, name, type, lines, day_of_month, use_last_day, start_date, end_date, next_run_date,
    is_system_generated, asset_id, created_by
  ) values (
    v_recurring_id, v_asset.company_id,
    'Penyusutan — ' || v_asset.name,
    'penyesuaian',
    jsonb_build_array(
      jsonb_build_object('account_id', p_expense_account_id, 'debit', v_monthly_amount, 'credit', 0),
      jsonb_build_object('account_id', p_accumulated_account_id, 'debit', 0, 'credit', v_monthly_amount)
    ),
    1, true, p_depreciation_start_date,
    (p_depreciation_start_date + (p_useful_life_months || ' months')::interval - interval '1 day')::date,
    compute_next_recurring_date(p_depreciation_start_date - 1, 1, true),
    true, p_asset_id, auth.uid()
  );
end;
$$ language plpgsql security invoker;
