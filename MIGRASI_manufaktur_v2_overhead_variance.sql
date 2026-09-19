-- ============================================================================
-- FITUR BARU: Overhead Variance (Actual vs Applied) — sebelumnya cuma ada
-- "Applied Overhead" (yang dibebankan ke WIP). Sekarang ditambah kemampuan
-- catat "Actual Overhead" (biaya overhead yang BENERAN keluar, misal listrik
-- pabrik bulan ini) secara terpisah — selisihnya jadi Overhead Variance.
--
-- Konsepnya: Applied Overhead tetap masuk WIP (biar Production Order jalan
-- kayak biasa). Actual Overhead dicatat sebagai jurnal biasa (Dr akun
-- overhead spesifik / Cr Kas-Bank-Hutang) TANPA nyentuh WIP sama sekali —
-- ini murni buat PERBANDINGAN belakangan, gak masuk hitungan cost produksi.
-- ============================================================================

create table if not exists manufacturing_actual_overheads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  date date not null,
  overhead_account_id uuid references accounts(id),
  payment_account_id uuid references accounts(id),
  amount numeric not null check (amount > 0),
  note text,
  transaction_id uuid references transactions(id) on delete cascade,
  created_by uuid, created_at timestamptz not null default now()
);
alter table manufacturing_actual_overheads enable row level security;
drop policy if exists "member can view actual overheads" on manufacturing_actual_overheads;
create policy "member can view actual overheads" on manufacturing_actual_overheads for select using (is_company_member(company_id));

create or replace function record_actual_overhead(
  p_company_id uuid, p_date date, p_overhead_account_id uuid, p_payment_account_id uuid, p_amount numeric, p_note text default null
) returns uuid as $$
declare
  v_transaction_id uuid; v_id uuid;
begin
  if not is_company_editor(p_company_id) then raise exception 'Kamu gak punya akses buat mencatat overhead di perusahaan ini'; end if;
  if p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;

  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_date::timestamptz, 'manufacturing_actual_overhead', coalesce(nullif(trim(p_note),''), 'Overhead Aktual'), auth.uid())
    returning id into v_transaction_id;

  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, p_overhead_account_id, p_amount, 0);
  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, p_payment_account_id, 0, p_amount);

  insert into manufacturing_actual_overheads (company_id, date, overhead_account_id, payment_account_id, amount, note, transaction_id, created_by)
    values (p_company_id, p_date, p_overhead_account_id, p_payment_account_id, p_amount, p_note, v_transaction_id, auth.uid())
    returning id into v_id;

  return v_id;
end;
$$ language plpgsql security invoker;

-- ============================================================================
-- get_manufacturing_inventory_summary — ringkasan stok Bahan Baku/WIP/Barang
-- Jadi/Scrap berdasarkan item_type produk, buat Laporan Manufacturing
-- Inventory.
-- ============================================================================
create or replace function get_manufacturing_inventory_summary(p_company_id uuid)
returns table (item_type text, product_id uuid, product_code text, product_name text, unit text, qty_on_hand numeric, avg_unit_cost numeric, total_value numeric) as $$
  select p.item_type, p.id, p.code, p.name, p.unit,
    coalesce(sum(pbs.qty_on_hand), 0),
    case when sum(pbs.qty_on_hand) > 0 then sum(pbs.qty_on_hand * pbs.avg_unit_cost) / sum(pbs.qty_on_hand) else 0 end,
    coalesce(sum(pbs.qty_on_hand * pbs.avg_unit_cost), 0)
  from products p
  left join product_branch_stock pbs on pbs.product_id = p.id
  where p.company_id = p_company_id
  group by p.item_type, p.id, p.code, p.name, p.unit
  having coalesce(sum(pbs.qty_on_hand), 0) <> 0
  order by p.item_type, p.name;
$$ language sql stable security invoker;
