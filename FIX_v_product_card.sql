-- ============================================================================
-- PERBAIKAN: v_product_card gagal diganti karena CREATE OR REPLACE VIEW gak
-- boleh menyisipkan kolom baru di tengah daftar kolom lama (cuma boleh
-- ditambah di paling akhir). Solusinya: DROP dulu, baru CREATE ulang.
-- Jalankan ini SEBAGAI GANTI bagian "10. Kartu Persediaan" yang gagal di
-- MIGRASI_modul_dagang_v10.sql, lalu lanjut ke sisa migrasi v10 & v11 seperti
-- biasa.
-- ============================================================================

drop view if exists v_product_card;

create view v_product_card as
select
  pm.id, pm.company_id, pm.product_id, p.code as product_code, p.name as product_name, p.unit,
  pm.cost_center_id, cc.name as cost_center_name,
  pm.date, pm.type, pm.qty, pm.unit_cost, pm.total_cost, pm.note,
  sum(case when pm.type = 'in' then pm.qty else -pm.qty end)
    over (partition by pm.product_id, pm.cost_center_id order by pm.date, pm.created_at rows between unbounded preceding and current row) as running_qty,
  sum(case when pm.type = 'in' then pm.total_cost else -pm.total_cost end)
    over (partition by pm.product_id, pm.cost_center_id order by pm.date, pm.created_at rows between unbounded preceding and current row) as running_value
from product_movements pm
join products p on p.id = pm.product_id
left join cost_centers cc on cc.id = pm.cost_center_id;

alter view v_product_card set (security_invoker = true);
