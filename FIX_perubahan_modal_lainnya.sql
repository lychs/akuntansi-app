-- ============================================================================
-- PERBAIKAN: Laporan Perubahan Modal sekarang nangkep SEMUA pergerakan akun
-- Modal, gak cuma dari transaksi berjenis "Tanam Modal"/"Tarik Modal" doang.
-- Transaksi General/Penyesuaian/Import yang nyentuh akun Modal (misal hasil
-- import Excel) bakal masuk baris "Transaksi Modal Lainnya" biar laporan
-- selalu balance, apapun jenis transaksi yang dipakai buat mencatatnya.
-- ============================================================================
create or replace function get_modal_other_movement(
  p_company_id uuid, p_start timestamptz, p_end timestamptz,
  p_cost_center_id uuid default null, p_department_id uuid default null, p_project_id uuid default null, p_warehouse_id uuid default null
)
returns numeric as $$
  select coalesce(sum(je.credit - je.debit), 0)
  from journal_entries je
  join accounts a on a.id = je.account_id
  join transactions t on t.id = je.transaction_id
  where a.category = 'modal' and t.type not in ('tanam_modal','tarik_modal') and t.company_id = p_company_id
    and t.date >= p_start and t.date < p_end
    and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
    and (p_department_id is null or t.department_id = p_department_id)
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id);
$$ language sql stable;
