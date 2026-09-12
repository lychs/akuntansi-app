-- ============================================================================
-- MIGRASI TAMBAHAN #3: RPC buat widget "Produk Terlaris" di Dashboard
-- Jalankan SETELAH migrasi #1 dan #2 modul Dagang.
-- ============================================================================

create or replace function get_top_selling_products(
  p_company_id uuid,
  p_start date,
  p_end date,
  p_limit int default 5
) returns table (product_id uuid, code text, name text, unit text, total_qty numeric, total_value numeric) as $$
  select pm.product_id, p.code, p.name, p.unit,
    sum(pm.qty) as total_qty,
    sum(pm.total_cost) as total_value
  from product_movements pm
  join products p on p.id = pm.product_id
  where pm.company_id = p_company_id
    and pm.type = 'out'
    and pm.date >= p_start and pm.date < (p_end + 1)
  group by pm.product_id, p.code, p.name, p.unit
  order by total_qty desc
  limit p_limit;
$$ language sql stable security invoker;
