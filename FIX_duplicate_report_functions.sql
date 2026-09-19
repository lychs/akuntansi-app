-- ============================================================================
-- PERBAIKAN PENTING #2: sama kayak masalah create_transaction kemarin, ternyata
-- get_trial_balance, get_general_ledger, get_journal_report, get_cash_movement,
-- get_modal_movement, dan get_available_layers JUGA menumpuk jadi beberapa
-- versi (gara-gara saya nambahin parameter filter Departemen/Proyek/Gudang di
-- migrasi belakangan). Ini yang bikin Dashboard, dan mungkin sebagian laporan,
-- gagal ambil data sama sekali.
--
-- Migrasi ini bersihin semua versi lama, bikin ulang cuma 1 versi final yang
-- benar. Aman dijalankan kapan aja.
-- ============================================================================

do $$
declare
  r record;
  fn text;
begin
  foreach fn in array array['get_trial_balance','get_general_ledger','get_journal_report','get_cash_movement','get_modal_movement','get_available_layers','get_transaction_report'] loop
    for r in
      select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute format('drop function if exists %s', r.sig);
    end loop;
  end loop;
end $$;

create or replace function get_trial_balance(
  p_company_id uuid, p_start date, p_end date, p_cost_center_id uuid default null,
  p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns table (
  account_id uuid, account_code text, account_name text,
  category account_category, normal_balance normal_balance,
  total_debit numeric, total_credit numeric
) as $$
  select
    a.id, a.code, a.name, a.category, a.normal_balance,
    coalesce(sum(je.debit),0) as total_debit,
    coalesce(sum(je.credit),0) as total_credit
  from accounts a
  left join journal_entries je on je.account_id = a.id
  left join transactions t on t.id = je.transaction_id
    and t.date >= p_start and t.date < (p_end + 1)
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
  where a.company_id = p_company_id
  group by a.id, a.code, a.name, a.category, a.normal_balance
  order by a.code;
$$ language sql stable;

create or replace function get_general_ledger(
  p_company_id uuid, p_account_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns table (
  journal_entry_id uuid, account_id uuid, account_code text, account_name text, normal_balance normal_balance,
  date timestamptz, note text, contact_name text, debit numeric, credit numeric, running_balance numeric
) as $$
  select
    je.id, je.account_id, a.code, a.name, a.normal_balance,
    t.date, t.note, c.name, je.debit, je.credit,
    sum(case when a.normal_balance = 'debit' then je.debit - je.credit else je.credit - je.debit end)
      over (order by t.date, je.id) as running_balance
  from journal_entries je
  join transactions t on t.id = je.transaction_id
  join accounts a on a.id = je.account_id
  left join contacts c on c.id = t.contact_id
  where t.company_id = p_company_id and je.account_id = p_account_id
    and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
  order by t.date, je.id;
$$ language sql stable;

create or replace function get_journal_report(
  p_company_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns table (
  transaction_id uuid, date timestamptz, note text,
  account_id uuid, account_code text, account_name text, debit numeric, credit numeric
) as $$
  select t.id, t.date, t.note, a.id, a.code, a.name, je.debit, je.credit
  from transactions t
  join journal_entries je on je.transaction_id = t.id
  join accounts a on a.id = je.account_id
  where t.company_id = p_company_id and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
  order by t.date desc, t.id;
$$ language sql stable;

create or replace function get_cash_movement(
  p_company_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns table (debit numeric, credit numeric, type text) as $$
  select je.debit, je.credit, t.type::text
  from journal_entries je
  join transactions t on t.id = je.transaction_id
  join accounts a on a.id = je.account_id
  where a.category = 'kas_bank' and t.company_id = p_company_id
    and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id);
$$ language sql stable;

create or replace function get_modal_movement(
  p_company_id uuid, p_type transaction_type, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns numeric as $$
  select coalesce(sum(je.credit - je.debit), 0)
  from journal_entries je
  join accounts a on a.id = je.account_id
  join transactions t on t.id = je.transaction_id
  where a.category = 'modal' and t.type = p_type and t.company_id = p_company_id
    and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id);
$$ language sql stable;

create or replace function get_available_layers(p_product_id uuid, p_cost_center_id uuid default null)
returns table (id uuid, purchase_date date, qty_remaining numeric, unit_cost numeric) as $$
  select id, purchase_date, qty_remaining, unit_cost
  from product_stock_layers
  where product_id = p_product_id and qty_remaining > 0
    and (p_cost_center_id is null or cost_center_id = p_cost_center_id)
  order by purchase_date asc, created_at asc;
$$ language sql stable security definer set search_path = public;

create or replace function get_transaction_report(
  p_company_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns table (
  id uuid, date timestamptz, type text, note text, contact_name text, total_amount numeric, receipt_path text
) as $$
  select t.id, t.date, t.type::text, t.note, c.name,
    coalesce((select sum(je.debit) from journal_entries je where je.transaction_id = t.id), 0),
    t.receipt_path
  from transactions t
  left join contacts c on c.id = t.contact_id
  where t.company_id = p_company_id and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
  order by t.date desc;
$$ language sql stable;
