-- ============================================================================
-- MIGRASI TAMBAHAN #9: Laporan lengkap per Cabang (bukan cuma Laba Rugi)
-- Nambahin filter opsional "cost center" (cabang) ke SEMUA laporan keuangan
-- inti — Neraca Saldo, Laba Rugi, Neraca, Perubahan Modal, Arus Kas, Buku
-- Besar, Jurnal, Laporan Transaksi, Beban Operasional, Hutang Piutang —
-- supaya bisa dipersempit jadi "laporan lengkap seolah cabang itu perusahaan
-- sendiri", bukan cuma ringkasan Laba Rugi doang.
-- Jalankan SETELAH migrasi v8.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. get_trial_balance: tambah filter cost_center_id opsional. Ini dipakai
--    Neraca Saldo, Laba Rugi, Neraca, Beban Operasional, dan sebagian
--    Perubahan Modal & Arus Kas.
-- ----------------------------------------------------------------------------
create or replace function get_trial_balance(
  p_company_id uuid, p_start date, p_end date, p_cost_center_id uuid default null
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
  where a.company_id = p_company_id
  group by a.id, a.code, a.name, a.category, a.normal_balance
  order by a.code;
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 2. get_general_ledger: pengganti view v_general_ledger — dijadikan fungsi
--    supaya saldo berjalan (running balance) dihitung ulang dengan benar
--    KHUSUS transaksi cabang tsb aja pas difilter (bukan ikut total company).
-- ----------------------------------------------------------------------------
create or replace function get_general_ledger(
  p_company_id uuid, p_account_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null
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
  order by t.date, je.id;
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 3. get_journal_report: buat halaman Jurnal — daftar transaksi + baris
--    jurnalnya, bisa difilter per cabang.
-- ----------------------------------------------------------------------------
create or replace function get_journal_report(
  p_company_id uuid, p_start timestamptz, p_end timestamptz, p_cost_center_id uuid default null
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
  order by t.date desc, t.id;
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 4. get_transaction_report: buat halaman Laporan Transaksi, per cabang.
-- ----------------------------------------------------------------------------
create or replace function get_transaction_report(
  p_company_id uuid, p_start timestamptz, p_end timestamptz, p_cost_center_id uuid default null
)
returns table (
  id uuid, date timestamptz, type text, note text, contact_name text, total_amount numeric
) as $$
  select t.id, t.date, t.type::text, t.note, c.name,
    coalesce((select sum(je.debit) from journal_entries je where je.transaction_id = t.id), 0)
  from transactions t
  left join contacts c on c.id = t.contact_id
  where t.company_id = p_company_id and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
  order by t.date desc;
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 5. get_cash_movement: buat halaman Arus Kas per cabang (menggantikan query
--    langsung journal_entries+transactions+accounts di frontend).
-- ----------------------------------------------------------------------------
create or replace function get_cash_movement(
  p_company_id uuid, p_start timestamptz, p_end timestamptz, p_cost_center_id uuid default null
)
returns table (debit numeric, credit numeric, type text) as $$
  select je.debit, je.credit, t.type::text
  from journal_entries je
  join transactions t on t.id = je.transaction_id
  join accounts a on a.id = je.account_id
  where a.category = 'kas_bank' and t.company_id = p_company_id
    and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id);
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 6. get_modal_movement: buat halaman Perubahan Modal per cabang.
-- ----------------------------------------------------------------------------
create or replace function get_modal_movement(
  p_company_id uuid, p_type transaction_type, p_start timestamptz, p_end timestamptz, p_cost_center_id uuid default null
)
returns numeric as $$
  select coalesce(sum(je.credit - je.debit), 0)
  from journal_entries je
  join accounts a on a.id = je.account_id
  join transactions t on t.id = je.transaction_id
  where a.category = 'modal' and t.type = p_type and t.company_id = p_company_id
    and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id);
$$ language sql stable;

-- ----------------------------------------------------------------------------
-- 7. Hutang Piutang: tambah cost_center_id ke receivables_payables (disalin
--    dari transactions pas dibuat) biar Laporan Hutang Piutang juga bisa
--    difilter per cabang.
-- ----------------------------------------------------------------------------
alter table receivables_payables add column if not exists cost_center_id uuid references cost_centers(id);

-- Ganti create_transaction sekali lagi: ikut simpan cost_center_id ke
-- receivables_payables juga (menyambung dari versi migrasi v8, semua
-- perilaku sebelumnya tetap ada).
create or replace function create_transaction(
  p_company_id uuid,
  p_date timestamptz,
  p_type transaction_type,
  p_note text,
  p_contact_id uuid,
  p_lines jsonb,
  p_due_date date default null,
  p_invoice_no text default null,
  p_cost_center_id uuid default null
) returns uuid as $$
declare
  v_txn_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_category text;
  v_asset_code text;
  v_asset_seq int;
  v_rp_amount numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;

  insert into transactions (company_id, date, type, note, contact_id, cost_center_id, created_by)
    values (p_company_id, p_date, p_type, p_note, p_contact_id, p_cost_center_id, auth.uid())
    returning id into v_txn_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);

    insert into journal_entries (transaction_id, account_id, debit, credit)
    values (v_txn_id, v_account_id, v_debit, v_credit);

    select category into v_category from accounts where id = v_account_id;

    if v_debit > 0 and v_category = 'harta_tetap' then
      select count(*) + 1 into v_asset_seq from assets where company_id = p_company_id;
      v_asset_code := 'AST-' || to_char(p_date, 'YYYYMM') || '-' || lpad(v_asset_seq::text, 3, '0');
      insert into assets (company_id, code, name, account_id, description, acquisition_date, acquisition_cost)
        values (p_company_id, v_asset_code, coalesce(nullif(trim(p_note), ''), 'Aset ' || v_asset_code), v_account_id, p_note, p_date::date, v_debit);
    end if;

    if p_type = 'piutang' and v_category = 'piutang' and v_debit > 0 then
      v_rp_amount := v_debit;
    elsif p_type = 'hutang' and v_category = 'hutang' and v_credit > 0 then
      v_rp_amount := v_credit;
    else
      v_rp_amount := null;
    end if;

    if v_rp_amount is not null then
      if p_contact_id is null then
        raise exception 'Transaksi Hutang/Piutang wajib pilih kontak';
      end if;
      insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount, cost_center_id)
        values (p_company_id, v_txn_id, p_contact_id,
          case when p_type = 'piutang' then 'piutang'::receivable_payable_type else 'hutang'::receivable_payable_type end,
          p_invoice_no, p_date::date, p_due_date, v_rp_amount, p_cost_center_id);
    end if;
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security invoker;
