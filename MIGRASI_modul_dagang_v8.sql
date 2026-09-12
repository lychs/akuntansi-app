-- ============================================================================
-- MIGRASI TAMBAHAN #8: Cost Center / Cabang + Jurnal Pembalik
-- Jalankan SETELAH migrasi v6 dan v7.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabel COST_CENTERS (cabang/departemen/pusat biaya)
-- ----------------------------------------------------------------------------
create table if not exists cost_centers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  code        text not null,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, code)
);
alter table cost_centers enable row level security;

drop policy if exists "member can view cost centers" on cost_centers;
create policy "member can view cost centers" on cost_centers
  for select using (is_company_member(company_id));
drop policy if exists "editor can insert cost centers" on cost_centers;
create policy "editor can insert cost centers" on cost_centers
  for insert with check (is_company_editor(company_id));
drop policy if exists "editor can update cost centers" on cost_centers;
create policy "editor can update cost centers" on cost_centers
  for update using (is_company_editor(company_id));
drop policy if exists "editor can delete cost centers" on cost_centers;
create policy "editor can delete cost centers" on cost_centers
  for delete using (is_company_editor(company_id));

-- ----------------------------------------------------------------------------
-- 2. Tambah kolom cost_center_id (opsional) ke transactions
-- ----------------------------------------------------------------------------
alter table transactions add column if not exists cost_center_id uuid references cost_centers(id);

-- ----------------------------------------------------------------------------
-- 3. Ganti create_transaction: terima cost center opsional (menyambung dari
--    versi migrasi v7 — semua perilaku sebelumnya tetap ada)
-- ----------------------------------------------------------------------------
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
      insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount)
        values (p_company_id, v_txn_id, p_contact_id,
          case when p_type = 'piutang' then 'piutang'::receivable_payable_type else 'hutang'::receivable_payable_type end,
          p_invoice_no, p_date::date, p_due_date, v_rp_amount);
    end if;
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- 4. RPC: get_cost_center_summary — ringkasan pendapatan/beban per cost center
--    buat Laporan per Cabang / Cost Center.
-- ----------------------------------------------------------------------------
create or replace function get_cost_center_summary(
  p_company_id uuid,
  p_start date,
  p_end date
) returns table (
  cost_center_id uuid, code text, name text,
  total_pendapatan numeric, total_beban numeric, net numeric, jumlah_transaksi bigint
) as $$
  select
    cc.id, cc.code, cc.name,
    coalesce(sum(case when a.category = 'pendapatan' then je.credit - je.debit else 0 end), 0) as total_pendapatan,
    coalesce(sum(case when a.category in ('beban_pokok','beban_operasional') then je.debit - je.credit else 0 end), 0) as total_beban,
    coalesce(sum(case
      when a.category = 'pendapatan' then je.credit - je.debit
      when a.category in ('beban_pokok','beban_operasional') then -(je.debit - je.credit)
      else 0 end), 0) as net,
    count(distinct t.id) as jumlah_transaksi
  from cost_centers cc
  left join transactions t on t.cost_center_id = cc.id and t.date >= p_start and t.date < (p_end + 1)
  left join journal_entries je on je.transaction_id = t.id
  left join accounts a on a.id = je.account_id
  where cc.company_id = p_company_id
  group by cc.id, cc.code, cc.name
  order by cc.code;
$$ language sql stable security invoker;

-- ----------------------------------------------------------------------------
-- 5. RPC: create_reversing_entry — Jurnal Pembalik. Ambil satu transaksi yang
--    sudah ada, bikin transaksi baru dengan semua baris jurnalnya DIBALIK
--    (debit jadi kredit, kredit jadi debit) di tanggal yang kamu pilih.
--    Umumnya dipakai buat membalik jurnal penyesuaian di awal periode berikutnya.
-- ----------------------------------------------------------------------------
create or replace function create_reversing_entry(
  p_transaction_id uuid,
  p_reversal_date timestamptz,
  p_note text default null
) returns uuid as $$
declare
  v_company_id uuid;
  v_orig_note text;
  v_new_txn_id uuid;
  v_line record;
begin
  select company_id, note into v_company_id, v_orig_note from transactions where id = p_transaction_id;
  if v_company_id is null then
    raise exception 'Transaksi asal tidak ditemukan';
  end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;

  insert into transactions (company_id, date, type, note, created_by)
    values (v_company_id, p_reversal_date, 'penyesuaian', coalesce(nullif(trim(p_note), ''), 'Jurnal pembalik dari: ' || v_orig_note), auth.uid())
    returning id into v_new_txn_id;

  for v_line in select account_id, debit, credit from journal_entries where transaction_id = p_transaction_id loop
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_new_txn_id, v_line.account_id, v_line.credit, v_line.debit);
  end loop;

  return v_new_txn_id;
end;
$$ language plpgsql security invoker;
