-- ============================================================================
-- MODUL MANUFAKTUR — Fase 1-9: Skema database lengkap + alur inti
-- (BOM → Production Order → Material Request/Issue → Direct Labor/Overhead
--  → Production Result), semua bikin jurnal otomatis & terhubung ke sistem
-- akuntansi existing (transactions/journal_entries) dan sistem stok existing
-- (product_movements/product_stock_layers/product_branch_stock).
--
-- PENTING: migrasi ini TIDAK mengubah/menghapus apapun dari modul Jasa/Dagang
-- yang udah ada — semuanya cuma tambahan (ALTER TABLE ADD COLUMN yang
-- nullable/ada default, dan CREATE TABLE baru).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Perluas PRODUCTS — tambah pembeda jenis item.
-- ----------------------------------------------------------------------------
alter table products add column if not exists item_type text not null default 'finished_goods'
  check (item_type in ('raw_material', 'supporting_material', 'wip', 'finished_goods', 'scrap'));

-- ----------------------------------------------------------------------------
-- 2. Akun default khusus Manufaktur di COMPANIES (pola sama kayak akun
--    default Dagang yang udah ada). inventory_account_id & cogs_account_id
--    yang UDAH ADA dipakai ulang sebagai "Raw Material Inventory" & "COGS".
-- ----------------------------------------------------------------------------
alter table companies add column if not exists wip_account_id uuid references accounts(id) on delete set null;
alter table companies add column if not exists finished_goods_account_id uuid references accounts(id) on delete set null;
alter table companies add column if not exists payroll_clearing_account_id uuid references accounts(id) on delete set null;
alter table companies add column if not exists manufacturing_overhead_account_id uuid references accounts(id) on delete set null;
alter table companies add column if not exists production_variance_account_id uuid references accounts(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. BILL OF MATERIALS — versi baru = baris baru, BOM lama TIDAK diubah.
-- ----------------------------------------------------------------------------
create table if not exists manufacturing_boms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  version int not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  effective_date date not null default current_date,
  note text,
  created_by uuid, created_at timestamptz not null default now()
);
alter table manufacturing_boms enable row level security;
drop policy if exists "member can view boms" on manufacturing_boms;
create policy "member can view boms" on manufacturing_boms for select using (is_company_member(company_id));
drop policy if exists "editor can manage boms" on manufacturing_boms;
create policy "editor can manage boms" on manufacturing_boms for all using (is_company_editor(company_id)) with check (is_company_editor(company_id));

create table if not exists manufacturing_bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references manufacturing_boms(id) on delete cascade,
  component_product_id uuid not null references products(id),
  qty_per_unit numeric not null check (qty_per_unit > 0),
  waste_percentage numeric not null default 0 check (waste_percentage >= 0 and waste_percentage < 100)
);
alter table manufacturing_bom_items enable row level security;
drop policy if exists "member can view bom items" on manufacturing_bom_items;
create policy "member can view bom items" on manufacturing_bom_items for select
  using (exists (select 1 from manufacturing_boms b where b.id = bom_id and is_company_member(b.company_id)));
drop policy if exists "editor can manage bom items" on manufacturing_bom_items;
create policy "editor can manage bom items" on manufacturing_bom_items for all
  using (exists (select 1 from manufacturing_boms b where b.id = bom_id and is_company_editor(b.company_id)))
  with check (exists (select 1 from manufacturing_boms b where b.id = bom_id and is_company_editor(b.company_id)));

-- ----------------------------------------------------------------------------
-- 4. PRODUCTION ORDER — pusat orkestrasi + cost pool WIP.
-- ----------------------------------------------------------------------------
create table if not exists production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_number text not null,
  date date not null default current_date,
  cost_center_id uuid references cost_centers(id),
  warehouse_id uuid references warehouses(id),
  product_id uuid not null references products(id),
  bom_id uuid not null references manufacturing_boms(id),
  planned_qty numeric not null check (planned_qty > 0),
  planned_start_date date, planned_finish_date date,
  actual_start_date date, actual_finish_date date,
  status text not null default 'draft' check (status in ('draft', 'released', 'in_progress', 'completed', 'cancelled')),
  accumulated_material_cost numeric not null default 0,
  accumulated_labor_cost numeric not null default 0,
  accumulated_overhead_cost numeric not null default 0,
  note text,
  created_by uuid, created_at timestamptz not null default now(),
  cancelled_by uuid, cancelled_at timestamptz
);
alter table production_orders enable row level security;
drop policy if exists "member can view production orders" on production_orders;
create policy "member can view production orders" on production_orders for select using (is_company_member(company_id));
drop policy if exists "editor can manage production orders" on production_orders;
create policy "editor can manage production orders" on production_orders for all using (is_company_editor(company_id)) with check (is_company_editor(company_id));

-- ----------------------------------------------------------------------------
-- 5. MATERIAL REQUEST
-- ----------------------------------------------------------------------------
create table if not exists material_requests (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references production_orders(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  date date not null default current_date,
  created_by uuid, created_at timestamptz not null default now()
);
alter table material_requests enable row level security;
drop policy if exists "member can view material requests" on material_requests;
create policy "member can view material requests" on material_requests for select using (is_company_member(company_id));
drop policy if exists "editor can manage material requests" on material_requests;
create policy "editor can manage material requests" on material_requests for all using (is_company_editor(company_id)) with check (is_company_editor(company_id));

create table if not exists material_request_items (
  id uuid primary key default gen_random_uuid(),
  material_request_id uuid not null references material_requests(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_needed numeric not null,
  qty_issued numeric not null default 0
);
alter table material_request_items enable row level security;
drop policy if exists "member can view material request items" on material_request_items;
create policy "member can view material request items" on material_request_items for select
  using (exists (select 1 from material_requests r where r.id = material_request_id and is_company_member(r.company_id)));
drop policy if exists "editor can manage material request items" on material_request_items;
create policy "editor can manage material request items" on material_request_items for all
  using (exists (select 1 from material_requests r where r.id = material_request_id and is_company_editor(r.company_id)))
  with check (exists (select 1 from material_requests r where r.id = material_request_id and is_company_editor(r.company_id)));

-- ----------------------------------------------------------------------------
-- 6. MATERIAL ISSUE (+items) — read-only tables, ditulis lewat RPC di bawah
--    biar konsisten sama jurnal & stok.
-- ----------------------------------------------------------------------------
create table if not exists material_issues (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references production_orders(id),
  company_id uuid not null references companies(id) on delete cascade,
  date date not null,
  cost_center_id uuid references cost_centers(id),
  warehouse_id uuid references warehouses(id),
  transaction_id uuid references transactions(id) on delete cascade,
  note text,
  created_by uuid, created_at timestamptz not null default now()
);
alter table material_issues enable row level security;
drop policy if exists "member can view material issues" on material_issues;
create policy "member can view material issues" on material_issues for select using (is_company_member(company_id));

create table if not exists material_issue_items (
  id uuid primary key default gen_random_uuid(),
  material_issue_id uuid not null references material_issues(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric not null, unit_cost numeric not null, total_cost numeric not null
);
alter table material_issue_items enable row level security;
drop policy if exists "member can view material issue items" on material_issue_items;
create policy "member can view material issue items" on material_issue_items for select
  using (exists (select 1 from material_issues m where m.id = material_issue_id and is_company_member(m.company_id)));

-- ----------------------------------------------------------------------------
-- 7. DIRECT LABOR & MANUFACTURING OVERHEAD — read-only, ditulis lewat RPC.
-- ----------------------------------------------------------------------------
create table if not exists manufacturing_direct_labor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  production_order_id uuid not null references production_orders(id),
  date date not null, amount numeric not null check (amount > 0), note text,
  transaction_id uuid references transactions(id) on delete cascade,
  created_by uuid, created_at timestamptz not null default now()
);
alter table manufacturing_direct_labor enable row level security;
drop policy if exists "member can view direct labor" on manufacturing_direct_labor;
create policy "member can view direct labor" on manufacturing_direct_labor for select using (is_company_member(company_id));

create table if not exists manufacturing_overheads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  production_order_id uuid not null references production_orders(id),
  date date not null,
  overhead_source_account_id uuid references accounts(id),
  applied_amount numeric not null check (applied_amount > 0), note text,
  transaction_id uuid references transactions(id) on delete cascade,
  created_by uuid, created_at timestamptz not null default now()
);
alter table manufacturing_overheads enable row level security;
drop policy if exists "member can view overheads" on manufacturing_overheads;
create policy "member can view overheads" on manufacturing_overheads for select using (is_company_member(company_id));

-- ----------------------------------------------------------------------------
-- 8. PRODUCTION RESULT — read-only, ditulis lewat RPC.
-- ----------------------------------------------------------------------------
create table if not exists production_results (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references production_orders(id),
  company_id uuid not null references companies(id) on delete cascade,
  date date not null,
  cost_center_id uuid references cost_centers(id),
  warehouse_id uuid references warehouses(id),
  good_qty numeric not null default 0, reject_qty numeric not null default 0, scrap_qty numeric not null default 0,
  total_wip_cost_absorbed numeric not null default 0, cost_per_unit numeric not null default 0,
  transaction_id uuid references transactions(id) on delete cascade,
  created_by uuid, created_at timestamptz not null default now()
);
alter table production_results enable row level security;
drop policy if exists "member can view production results" on production_results;
create policy "member can view production results" on production_results for select using (is_company_member(company_id));

-- ============================================================================
-- RPC — ALUR INTI
-- ============================================================================

-- ----------------------------------------------------------------------------
-- create_production_order — bikin PO (status Draft), SNAPSHOT BOM aktif saat
-- ini (perubahan BOM belakangan TIDAK mempengaruhi PO yang udah dibuat).
-- ----------------------------------------------------------------------------
create or replace function create_production_order(
  p_company_id uuid, p_date date, p_cost_center_id uuid, p_warehouse_id uuid,
  p_product_id uuid, p_planned_qty numeric, p_planned_start_date date, p_planned_finish_date date, p_note text default null
) returns uuid as $$
declare
  v_bom_id uuid; v_order_id uuid; v_order_number text; v_seq int;
begin
  if not is_company_editor(p_company_id) then raise exception 'Kamu gak punya akses buat bikin Production Order'; end if;
  if p_planned_qty <= 0 then raise exception 'Qty rencana harus lebih dari 0'; end if;

  select id into v_bom_id from manufacturing_boms
    where company_id = p_company_id and product_id = p_product_id and status = 'active'
    order by version desc limit 1;
  if v_bom_id is null then raise exception 'Belum ada BOM aktif buat produk ini'; end if;

  select count(*) + 1 into v_seq from production_orders where company_id = p_company_id;
  v_order_number := 'PO-' || to_char(p_date, 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  insert into production_orders (company_id, order_number, date, cost_center_id, warehouse_id, product_id, bom_id, planned_qty, planned_start_date, planned_finish_date, note, created_by)
    values (p_company_id, v_order_number, p_date, p_cost_center_id, p_warehouse_id, p_product_id, v_bom_id, p_planned_qty, p_planned_start_date, p_planned_finish_date, p_note, auth.uid())
    returning id into v_order_id;

  return v_order_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- release_production_order — Draft -> Released, otomatis bikin Material
-- Request dari BOM x planned_qty (plus waste%).
-- ----------------------------------------------------------------------------
create or replace function release_production_order(p_production_order_id uuid) returns uuid as $$
declare
  v_po record; v_request_id uuid; v_item record;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  if not is_company_editor(v_po.company_id) then raise exception 'Kamu gak punya akses'; end if;
  if v_po.status <> 'draft' then raise exception 'Cuma Production Order berstatus Draft yang bisa di-release'; end if;

  insert into material_requests (production_order_id, company_id, date, created_by)
    values (p_production_order_id, v_po.company_id, current_date, auth.uid())
    returning id into v_request_id;

  for v_item in select * from manufacturing_bom_items where bom_id = v_po.bom_id loop
    insert into material_request_items (material_request_id, product_id, qty_needed)
      values (v_request_id, v_item.component_product_id, v_po.planned_qty * v_item.qty_per_unit * (1 + v_item.waste_percentage / 100.0));
  end loop;

  update production_orders set status = 'released' where id = p_production_order_id;
  return v_request_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- record_material_issue — bahan BENERAN keluar gudang. Konsumsi stok pakai
-- metode costing perusahaan (FIFO/Average/Specific), sama persis pola yang
-- dipakai record_sale — cuma tujuannya WIP, bukan COGS.
-- Jurnal: Dr WIP / Cr Persediaan Bahan Baku.
-- ----------------------------------------------------------------------------
create or replace function record_material_issue(
  p_production_order_id uuid, p_date timestamptz, p_lines jsonb, p_note text default null
) returns uuid as $$
declare
  v_po record; v_company_id uuid; v_method text;
  v_wip_account_id uuid; v_raw_material_account_id uuid;
  v_transaction_id uuid; v_issue_id uuid;
  v_line jsonb; v_product_id uuid; v_qty numeric;
  v_total_material_cost numeric := 0; v_line_cost numeric;
  v_remaining_to_consume numeric; v_layer record; v_consume numeric;
  v_qty_on_hand numeric; v_avg_cost numeric;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  v_company_id := v_po.company_id;
  if not is_company_editor(v_company_id) then raise exception 'Kamu gak punya akses'; end if;
  if v_po.status not in ('released', 'in_progress') then
    raise exception 'Material Issue cuma bisa dicatat buat Production Order berstatus Released/In Progress';
  end if;

  select inventory_method, wip_account_id, inventory_account_id
    into v_method, v_wip_account_id, v_raw_material_account_id from companies where id = v_company_id;
  if v_wip_account_id is null or v_raw_material_account_id is null then
    raise exception 'Akun WIP / Persediaan Bahan Baku belum diset di Profil Perusahaan';
  end if;

  insert into transactions (company_id, date, type, note, cost_center_id, warehouse_id, created_by)
    values (v_company_id, p_date, 'material_issue', coalesce(nullif(trim(p_note), ''), 'Material Issue - ' || v_po.order_number), v_po.cost_center_id, v_po.warehouse_id, auth.uid())
    returning id into v_transaction_id;

  insert into material_issues (production_order_id, company_id, date, cost_center_id, warehouse_id, transaction_id, note, created_by)
    values (p_production_order_id, v_company_id, p_date::date, v_po.cost_center_id, v_po.warehouse_id, v_transaction_id, p_note, auth.uid())
    returning id into v_issue_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    if v_qty <= 0 then raise exception 'Qty tidak valid'; end if;

    select coalesce(qty_on_hand,0), coalesce(avg_unit_cost,0) into v_qty_on_hand, v_avg_cost
      from product_branch_stock where product_id = v_product_id and cost_center_id = v_po.cost_center_id for update;
    v_qty_on_hand := coalesce(v_qty_on_hand, 0);
    if v_qty_on_hand < v_qty then
      raise exception 'Stok bahan baku tidak cukup (sisa: %, diminta: %)', v_qty_on_hand, v_qty;
    end if;

    if v_method = 'fifo' then
      v_line_cost := 0;
      v_remaining_to_consume := v_qty;
      for v_layer in
        select id, qty_remaining, unit_cost from product_stock_layers
        where product_id = v_product_id and cost_center_id = v_po.cost_center_id and qty_remaining > 0
        order by purchase_date asc, created_at asc for update
      loop
        exit when v_remaining_to_consume <= 0;
        v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
        update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
        v_line_cost := v_line_cost + (v_consume * v_layer.unit_cost);
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
          values (v_company_id, v_product_id, v_transaction_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note, v_po.cost_center_id);
        v_remaining_to_consume := v_remaining_to_consume - v_consume;
      end loop;
      if v_remaining_to_consume > 0 then raise exception 'Stok FIFO tidak konsisten — hubungi admin'; end if;
    else
      v_line_cost := v_qty * v_avg_cost;
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
        values (v_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_avg_cost, v_line_cost, p_note, v_po.cost_center_id);
    end if;

    perform adjust_branch_stock(v_company_id, v_product_id, v_po.cost_center_id, -v_qty, v_avg_cost);
    insert into material_issue_items (material_issue_id, product_id, qty, unit_cost, total_cost)
      values (v_issue_id, v_product_id, v_qty, case when v_qty > 0 then v_line_cost / v_qty else 0 end, v_line_cost);
    v_total_material_cost := v_total_material_cost + v_line_cost;
  end loop;

  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_wip_account_id, v_total_material_cost, 0);
  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_raw_material_account_id, 0, v_total_material_cost);

  update production_orders
    set accumulated_material_cost = accumulated_material_cost + v_total_material_cost,
        status = case when status = 'released' then 'in_progress' else status end,
        actual_start_date = coalesce(actual_start_date, p_date::date)
    where id = p_production_order_id;

  return v_issue_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- record_direct_labor — biaya tenaga kerja langsung, dicatat manual.
-- Jurnal: Dr WIP / Cr Payroll Clearing.
-- ----------------------------------------------------------------------------
create or replace function record_direct_labor(
  p_production_order_id uuid, p_date date, p_amount numeric, p_note text default null
) returns uuid as $$
declare
  v_po record; v_wip_account_id uuid; v_payroll_account_id uuid;
  v_transaction_id uuid; v_labor_id uuid;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  if not is_company_editor(v_po.company_id) then raise exception 'Kamu gak punya akses'; end if;
  if p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;

  select wip_account_id, payroll_clearing_account_id into v_wip_account_id, v_payroll_account_id from companies where id = v_po.company_id;
  if v_wip_account_id is null or v_payroll_account_id is null then
    raise exception 'Akun WIP / Payroll Clearing belum diset di Profil Perusahaan';
  end if;

  insert into transactions (company_id, date, type, note, cost_center_id, warehouse_id, created_by)
    values (v_po.company_id, p_date::timestamptz, coalesce(nullif(trim(p_note),''), 'Tenaga Kerja Langsung - ' || v_po.order_number), 'manufacturing_labor', v_po.cost_center_id, v_po.warehouse_id, auth.uid())
    returning id into v_transaction_id;

  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_wip_account_id, p_amount, 0);
  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_payroll_account_id, 0, p_amount);

  insert into manufacturing_direct_labor (company_id, production_order_id, date, amount, note, transaction_id, created_by)
    values (v_po.company_id, p_production_order_id, p_date, p_amount, p_note, v_transaction_id, auth.uid())
    returning id into v_labor_id;

  update production_orders set accumulated_labor_cost = accumulated_labor_cost + p_amount where id = p_production_order_id;
  return v_labor_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- record_manufacturing_overhead — biaya overhead produksi (applied).
-- Jurnal: Dr WIP / Cr [akun overhead yang dipilih].
-- ----------------------------------------------------------------------------
create or replace function record_manufacturing_overhead(
  p_production_order_id uuid, p_date date, p_overhead_source_account_id uuid, p_amount numeric, p_note text default null
) returns uuid as $$
declare
  v_po record; v_wip_account_id uuid;
  v_transaction_id uuid; v_overhead_id uuid;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  if not is_company_editor(v_po.company_id) then raise exception 'Kamu gak punya akses'; end if;
  if p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;

  select wip_account_id into v_wip_account_id from companies where id = v_po.company_id;
  if v_wip_account_id is null then raise exception 'Akun WIP belum diset di Profil Perusahaan'; end if;

  insert into transactions (company_id, date, type, note, cost_center_id, warehouse_id, created_by)
    values (v_po.company_id, p_date::timestamptz, coalesce(nullif(trim(p_note),''), 'Overhead Produksi - ' || v_po.order_number), 'manufacturing_overhead', v_po.cost_center_id, v_po.warehouse_id, auth.uid())
    returning id into v_transaction_id;

  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_wip_account_id, p_amount, 0);
  insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, p_overhead_source_account_id, 0, p_amount);

  insert into manufacturing_overheads (company_id, production_order_id, date, overhead_source_account_id, applied_amount, note, transaction_id, created_by)
    values (v_po.company_id, p_production_order_id, p_date, p_overhead_source_account_id, p_amount, p_note, v_transaction_id, auth.uid())
    returning id into v_overhead_id;

  update production_orders set accumulated_overhead_cost = accumulated_overhead_cost + p_amount where id = p_production_order_id;
  return v_overhead_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- record_production_result — produksi selesai (bisa dicatat bertahap/partial,
-- atau sekali di akhir). Cost per unit dihitung dari SISA WIP cost pool yang
-- belum "diserap" dibagi good_qty kali ini (bukan asumsi PO cuma sekali hasil).
-- Jurnal: Dr Finished Goods / Cr WIP.
-- ----------------------------------------------------------------------------
create or replace function record_production_result(
  p_production_order_id uuid, p_date date, p_good_qty numeric, p_reject_qty numeric default 0, p_scrap_qty numeric default 0, p_note text default null
) returns uuid as $$
declare
  v_po record; v_wip_account_id uuid; v_fg_account_id uuid;
  v_total_wip_cost numeric; v_already_absorbed numeric;
  v_wip_remaining numeric; v_cost_to_absorb numeric; v_cost_per_unit numeric;
  v_transaction_id uuid; v_result_id uuid;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  if not is_company_editor(v_po.company_id) then raise exception 'Kamu gak punya akses'; end if;
  if v_po.status not in ('in_progress', 'released') then
    raise exception 'Production Result cuma bisa dicatat buat Production Order berstatus Released/In Progress';
  end if;
  if p_good_qty < 0 or p_reject_qty < 0 or p_scrap_qty < 0 then raise exception 'Qty tidak boleh negatif'; end if;
  if p_good_qty + p_reject_qty + p_scrap_qty <= 0 then raise exception 'Minimal ada 1 qty (good/reject/scrap)'; end if;

  select wip_account_id, finished_goods_account_id into v_wip_account_id, v_fg_account_id from companies where id = v_po.company_id;
  if v_wip_account_id is null or v_fg_account_id is null then
    raise exception 'Akun WIP / Finished Goods belum diset di Profil Perusahaan';
  end if;

  v_total_wip_cost := v_po.accumulated_material_cost + v_po.accumulated_labor_cost + v_po.accumulated_overhead_cost;
  select coalesce(sum(total_wip_cost_absorbed), 0) into v_already_absorbed from production_results where production_order_id = p_production_order_id;
  v_wip_remaining := v_total_wip_cost - v_already_absorbed;
  if v_wip_remaining <= 0 then raise exception 'Gak ada sisa biaya WIP buat diserap — cek Material Issue/Tenaga Kerja/Overhead-nya dulu'; end if;

  -- Cost per unit pakai patokan planned_qty (standar) — biar reject/scrap gak
  -- bikin good_qty yang tersisa "mahal sendiri". Sisa WIP yang gak keserap
  -- good_qty otomatis jadi Production Variance kalau PO ditutup (Completed).
  v_cost_per_unit := v_total_wip_cost / v_po.planned_qty;
  v_cost_to_absorb := least(v_wip_remaining, v_cost_per_unit * p_good_qty);

  insert into transactions (company_id, date, type, note, cost_center_id, warehouse_id, created_by)
    values (v_po.company_id, p_date::timestamptz, coalesce(nullif(trim(p_note),''), 'Hasil Produksi - ' || v_po.order_number), 'production_result', v_po.cost_center_id, v_po.warehouse_id, auth.uid())
    returning id into v_transaction_id;

  if v_cost_to_absorb > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_fg_account_id, v_cost_to_absorb, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_wip_account_id, 0, v_cost_to_absorb);
  end if;

  if p_good_qty > 0 then
    insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note, cost_center_id)
      values (v_po.company_id, v_po.product_id, v_transaction_id, p_date, 'in', p_good_qty, v_cost_per_unit, v_cost_to_absorb, p_note, v_po.cost_center_id);
    perform adjust_branch_stock(v_po.company_id, v_po.product_id, v_po.cost_center_id, p_good_qty, v_cost_per_unit);
    insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id, cost_center_id)
      values (v_po.company_id, v_po.product_id, p_date, p_good_qty, v_cost_per_unit, v_transaction_id, v_po.cost_center_id);
  end if;

  insert into production_results (production_order_id, company_id, date, cost_center_id, warehouse_id, good_qty, reject_qty, scrap_qty, total_wip_cost_absorbed, cost_per_unit, transaction_id, created_by)
    values (p_production_order_id, v_po.company_id, p_date, v_po.cost_center_id, v_po.warehouse_id, p_good_qty, p_reject_qty, p_scrap_qty, v_cost_to_absorb, v_cost_per_unit, v_transaction_id, auth.uid())
    returning id into v_result_id;

  return v_result_id;
end;
$$ language plpgsql security invoker;

-- ----------------------------------------------------------------------------
-- complete_production_order — tutup PO. Sisa WIP yang gak keserap (karena
-- reject/scrap atau qty aktual < rencana) otomatis dijurnal jadi Production
-- Variance, biar WIP gak "nyangkut" nilai yang gak jelas selamanya.
-- ----------------------------------------------------------------------------
create or replace function complete_production_order(p_production_order_id uuid, p_date date default current_date) returns void as $$
declare
  v_po record; v_wip_account_id uuid; v_variance_account_id uuid;
  v_total_wip_cost numeric; v_total_absorbed numeric; v_variance numeric;
  v_transaction_id uuid;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  if not is_company_editor(v_po.company_id) then raise exception 'Kamu gak punya akses'; end if;
  if v_po.status not in ('in_progress', 'released') then raise exception 'Cuma PO Released/In Progress yang bisa diselesaikan'; end if;

  select wip_account_id, production_variance_account_id into v_wip_account_id, v_variance_account_id from companies where id = v_po.company_id;

  v_total_wip_cost := v_po.accumulated_material_cost + v_po.accumulated_labor_cost + v_po.accumulated_overhead_cost;
  select coalesce(sum(total_wip_cost_absorbed), 0) into v_total_absorbed from production_results where production_order_id = p_production_order_id;
  v_variance := v_total_wip_cost - v_total_absorbed;

  if v_variance > 0.01 and v_variance_account_id is not null and v_wip_account_id is not null then
    insert into transactions (company_id, date, type, note, cost_center_id, warehouse_id, created_by)
      values (v_po.company_id, p_date::timestamptz, 'Production Variance - ' || v_po.order_number, 'production_variance', v_po.cost_center_id, v_po.warehouse_id, auth.uid())
      returning id into v_transaction_id;
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_variance_account_id, v_variance, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_transaction_id, v_wip_account_id, 0, v_variance);
    insert into manufacturing_variances (company_id, production_order_id, variance_type, amount, date)
      values (v_po.company_id, p_production_order_id, 'production', v_variance, p_date);
  end if;

  update production_orders set status = 'completed', actual_finish_date = p_date where id = p_production_order_id;
end;
$$ language plpgsql security invoker;

create table if not exists manufacturing_variances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  production_order_id uuid not null references production_orders(id),
  variance_type text not null check (variance_type in ('overhead', 'production')),
  amount numeric not null, date date not null,
  created_at timestamptz not null default now()
);
alter table manufacturing_variances enable row level security;
drop policy if exists "member can view variances" on manufacturing_variances;
create policy "member can view variances" on manufacturing_variances for select using (is_company_member(company_id));

-- ----------------------------------------------------------------------------
-- cancel_production_order — cuma bisa kalau BELUM ada Material Issue/Labor/
-- Overhead/Result sama sekali (biar gak perlu logic reversal kompleks di
-- fase awal ini — kalau udah ada progress, harus di-complete, bukan cancel).
-- ----------------------------------------------------------------------------
create or replace function cancel_production_order(p_production_order_id uuid) returns void as $$
declare
  v_po record; v_has_activity boolean;
begin
  select * into v_po from production_orders where id = p_production_order_id;
  if v_po is null then raise exception 'Production Order tidak ditemukan'; end if;
  if not is_company_editor(v_po.company_id) then raise exception 'Kamu gak punya akses'; end if;

  v_has_activity := v_po.accumulated_material_cost > 0 or v_po.accumulated_labor_cost > 0 or v_po.accumulated_overhead_cost > 0;
  if v_has_activity then
    raise exception 'Production Order ini udah ada aktivitas (bahan/tenaga kerja/overhead) — gak bisa dibatalkan, selesaikan (Complete) sebagai gantinya';
  end if;

  update production_orders set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now() where id = p_production_order_id;
end;
$$ language plpgsql security invoker;
