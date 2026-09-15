-- ============================================================================
-- PERBAIKAN KRITIS: get_trial_balance ternyata SELALU menjumlahkan SEMUA
-- transaksi dari awal berdirinya perusahaan, BUKAN cuma yang di rentang
-- tanggal yang dipilih — meskipun tampilan periode di layar keliatannya
-- berubah normal.
--
-- Penyebabnya: filter tanggal ditaruh di klausa ON pada LEFT JOIN kedua
-- (join ke transactions), padahal SUM(je.debit)/SUM(je.credit) diambil dari
-- journal_entries yang di-LEFT-JOIN pertama (gak ikut kefilter, soalnya LEFT
-- JOIN tetap nyisain baris je walau kondisi ON di JOIN berikutnya gagal).
-- Efeknya: SEMUA baris journal_entries ke-ikut kejumlah gak peduli tanggalnya.
--
-- Ini kena ke SEMUA laporan yang bergantung ke get_trial_balance buat angka
-- PER PERIODE (Neraca Saldo, Laba Rugi, Beban Operasional, dan KPI/grafik
-- bulanan di Dashboard). Laporan yang query dari "1900-01-01" doang (kayak
-- Neraca "as of tanggal X") gak kelihatan bug-nya karena rentang emang dari
-- awal beneran.
--
-- Perbaikan: filter tanggal & dimension dipindah ke SUBQUERY yang nge-JOIN
-- journal_entries + transactions LEBIH DULU (baru itu yang di-LEFT-JOIN ke
-- accounts), biar filternya beneran ngefek.
-- ============================================================================

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
  left join (
    select je2.account_id, je2.debit, je2.credit
    from journal_entries je2
    join transactions t on t.id = je2.transaction_id
    where t.company_id = p_company_id
      and t.date >= p_start and t.date < (p_end + 1)
      and (p_cost_center_id is null or t.cost_center_id = p_cost_center_id)
      and (p_department_id is null or t.department_id = p_department_id)
      and (p_project_id is null or t.project_id = p_project_id)
      and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
  ) je on je.account_id = a.id
  where a.company_id = p_company_id
  group by a.id, a.code, a.name, a.category, a.normal_balance
  order by a.code;
$$ language sql stable;
