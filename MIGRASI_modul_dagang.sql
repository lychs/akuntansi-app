-- ============================================================================
-- MIGRASI: Modul Akuntansi Dagang (Persediaan, Pembelian, Penjualan, HPP otomatis)
-- Jalankan di Supabase → SQL Editor → New Query → paste semua → Run.
-- Aman dijalankan berkali-kali (pakai IF NOT EXISTS / CREATE OR REPLACE).
--
-- CATATAN PENTING: kalau muncul error seperti "unsafe use of new value of enum
-- type" saat Run, itu artinya PostgreSQL gak suka nilai enum baru dipakai di
-- transaksi yang sama saat dia dibuat. Solusinya: jalankan DULU 2 baris paling
-- atas (yang "alter type transaction_type add value...") SENDIRIAN sebagai
-- 1 query terpisah, klik Run, baru abis itu select-all sisa SQL di bawahnya dan
-- Run lagi sebagai query kedua.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Tambah jenis transaksi baru ke enum transaction_type
-- ----------------------------------------------------------------------------
alter type transaction_type add value if not exists 'pembelian_barang';
alter type transaction_type add value if not exists 'penjualan_barang';

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di companies: jenis usaha + metode persediaan + akun default
-- ----------------------------------------------------------------------------
alter table companies add column if not exists business_type text not null default 'jasa'
  check (business_type in ('jasa', 'dagang', 'manufaktur'));
alter table companies add column if not exists inventory_method text
  check (inventory_method in ('fifo', 'average'));
alter table companies add column if not exists inventory_account_id uuid references accounts(id);
alter table companies add column if not exists cogs_account_id uuid references accounts(id);
alter table companies add column if not exists sales_revenue_account_id uuid references accounts(id);

-- ----------------------------------------------------------------------------
-- 2. Tabel PRODUCTS (master data barang dagangan)
-- ----------------------------------------------------------------------------
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  code           text not null,
  name           text not null,
  unit           text not null default 'pcs',
  sale_price     numeric not null default 0,
  qty_on_hand    numeric not null default 0,
  avg_unit_cost  numeric not null default 0,  -- dipakai kalau inventory_method = 'average'
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (company_id, code)
);
alter table products enable row level security;

drop policy if exists "member can view products" on products;
create policy "member can view products" on products
  for select using (is_company_member(company_id));
drop policy if exists "editor can insert products" on products;
create policy "editor can insert products" on products
  for insert with check (is_company_editor(company_id));
drop policy if exists "editor can update products" on products;
create policy "editor can update products" on products
  for update using (is_company_editor(company_id));
drop policy if exists "editor can delete products" on products;
create policy "editor can delete products" on products
  for delete using (is_company_editor(company_id));

-- ----------------------------------------------------------------------------
-- 3. Tabel PRODUCT_STOCK_LAYERS (lapisan stok per pembelian — dipakai buat FIFO)
-- ----------------------------------------------------------------------------
create table if not exists product_stock_layers (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  product_id     uuid not null references products(id) on delete cascade,
  purchase_date  date not null,
  qty_remaining  numeric not null,
  unit_cost      numeric not null,
  transaction_id uuid references transactions(id),
  created_at     timestamptz not null default now()
);
alter table product_stock_layers enable row level security;

drop policy if exists "member can view stock layers" on product_stock_layers;
create policy "member can view stock layers" on product_stock_layers
  for select using (is_company_member(company_id));

-- ----------------------------------------------------------------------------
-- 4. Tabel PRODUCT_MOVEMENTS (kartu persediaan — mutasi masuk/keluar per barang)
-- ----------------------------------------------------------------------------
create table if not exists product_movements (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  product_id     uuid not null references products(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  date           timestamptz not null,
  type           text not null check (type in ('in', 'out')),
  qty            numeric not null,
  unit_cost      numeric not null,
  total_cost     numeric not null,
  note           text,
  created_at     timestamptz not null default now()
);
alter table product_movements enable row level security;

drop policy if exists "member can view product movements" on product_movements;
create policy "member can view product movements" on product_movements
  for select using (is_company_member(company_id));

-- ----------------------------------------------------------------------------
-- 5. Ganti create_company: terima jenis usaha + metode persediaan, dan kalau
--    "dagang", otomatis bikinkan 3 akun wajib (Persediaan, HPP, Pendapatan
--    Penjualan Barang) + simpan referensinya ke companies.
-- ----------------------------------------------------------------------------
create or replace function create_company(
  p_name text,
  p_business_name text default null,
  p_category text default null,
  p_business_field text default null,
  p_logo_url text default null,
  p_business_type text default 'jasa',
  p_inventory_method text default null
) returns uuid as $$
declare
  v_company_id uuid;
  v_inventory_account_id uuid;
  v_cogs_account_id uuid;
  v_revenue_account_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Nama perusahaan tidak boleh kosong';
  end if;
  if p_business_type not in ('jasa', 'dagang', 'manufaktur') then
    raise exception 'Jenis usaha tidak valid';
  end if;
  if p_business_type = 'dagang' and p_inventory_method not in ('fifo', 'average') then
    raise exception 'Metode persediaan wajib dipilih (FIFO atau Rata-rata) untuk usaha dagang';
  end if;

  insert into companies (name, business_name, category, business_field, logo_url, business_type, inventory_method)
    values (trim(p_name), nullif(trim(p_business_name),''), p_category, p_business_field, p_logo_url, p_business_type, p_inventory_method)
    returning id into v_company_id;
  insert into company_users (company_id, user_id, role, email) values (v_company_id, auth.uid(), 'admin', auth.email());

  if p_business_type = 'dagang' then
    insert into accounts (company_id, code, name, category, normal_balance, description, is_locked)
      values (v_company_id, '1-14000', 'Persediaan Barang Dagang', 'persediaan', 'debit', 'Akun persediaan otomatis untuk modul Dagang', true)
      returning id into v_inventory_account_id;
    insert into accounts (company_id, code, name, category, normal_balance, description, is_locked)
      values (v_company_id, '5-51000', 'Harga Pokok Penjualan', 'beban_pokok', 'debit', 'Akun HPP otomatis untuk modul Dagang', true)
      returning id into v_cogs_account_id;
    insert into accounts (company_id, code, name, category, normal_balance, description, is_locked)
      values (v_company_id, '4-41000', 'Pendapatan Penjualan Barang', 'pendapatan', 'kredit', 'Akun pendapatan otomatis untuk modul Dagang', true)
      returning id into v_revenue_account_id;

    update companies set
      inventory_account_id = v_inventory_account_id,
      cogs_account_id = v_cogs_account_id,
      sales_revenue_account_id = v_revenue_account_id
    where id = v_company_id;
  end if;

  return v_company_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 6. RPC: create_product — tambah barang baru
-- ----------------------------------------------------------------------------
create or replace function create_product(
  p_company_id uuid,
  p_code text,
  p_name text,
  p_unit text,
  p_sale_price numeric
) returns uuid as $$
declare
  v_product_id uuid;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat tambah barang di perusahaan ini';
  end if;
  insert into products (company_id, code, name, unit, sale_price)
    values (p_company_id, trim(p_code), trim(p_name), coalesce(nullif(trim(p_unit),''), 'pcs'), p_sale_price)
    returning id into v_product_id;
  return v_product_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 7. RPC: record_purchase — transaksi pembelian barang dagang
--    p_lines: jsonb array [{ "product_id": "...", "qty": 10, "unit_cost": 5000 }, ...]
--    Efeknya: 1 transaksi + jurnal (Debit Persediaan / Kredit akun bayar),
--    tambah stok barang, catat layer FIFO & mutasi kartu persediaan.
-- ----------------------------------------------------------------------------
create or replace function record_purchase(
  p_company_id uuid,
  p_date timestamptz,
  p_contact_id uuid,
  p_note text,
  p_payment_account_id uuid,
  p_lines jsonb
) returns uuid as $$
declare
  v_transaction_id uuid;
  v_inventory_account_id uuid;
  v_line jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_unit_cost numeric;
  v_total numeric := 0;
  v_qty_before numeric;
  v_avg_before numeric;
  v_method text;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat pembelian di perusahaan ini';
  end if;
  select inventory_account_id, inventory_method into v_inventory_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'Minimal 1 baris barang';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total := v_total + (v_line->>'qty')::numeric * (v_line->>'unit_cost')::numeric;
  end loop;

  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (p_company_id, p_date, 'pembelian_barang', p_note, p_contact_id, auth.uid())
    returning id into v_transaction_id;

  -- Jurnal cuma diinsert kalau nominalnya > 0 — tabel journal_entries menolak baris
  -- yang debit DAN kredit-nya sama-sama 0 (lihat constraint di skema).
  if v_total > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, v_inventory_account_id, v_total, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, p_payment_account_id, 0, v_total);
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_unit_cost := (v_line->>'unit_cost')::numeric;

    if v_qty <= 0 or v_unit_cost < 0 then
      raise exception 'Qty dan harga beli tidak valid';
    end if;

    insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id)
      values (p_company_id, v_product_id, p_date::date, v_qty, v_unit_cost, v_transaction_id);

    insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
      values (p_company_id, v_product_id, v_transaction_id, p_date, 'in', v_qty, v_unit_cost, v_qty * v_unit_cost, p_note);

    select qty_on_hand, avg_unit_cost into v_qty_before, v_avg_before from products where id = v_product_id;

    if v_method = 'average' then
      update products set
        avg_unit_cost = case when (v_qty_before + v_qty) > 0
          then ((v_qty_before * v_avg_before) + (v_qty * v_unit_cost)) / (v_qty_before + v_qty)
          else 0 end,
        qty_on_hand = v_qty_before + v_qty
      where id = v_product_id;
    else
      update products set qty_on_hand = v_qty_before + v_qty where id = v_product_id;
    end if;
  end loop;

  return v_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 8. RPC: record_sale — transaksi penjualan barang dagang (HPP dihitung OTOMATIS
--    sesuai metode FIFO / Rata-rata yang dipilih perusahaan)
--    p_lines: jsonb array [{ "product_id": "...", "qty": 5, "sale_price": 12000 }, ...]
--    Efeknya: 1 transaksi + 2 pasang jurnal (Pendapatan & HPP), kurangi stok,
--    konsumsi layer FIFO (kalau metodenya FIFO), catat mutasi kartu persediaan.
-- ----------------------------------------------------------------------------
create or replace function record_sale(
  p_company_id uuid,
  p_date timestamptz,
  p_contact_id uuid,
  p_note text,
  p_receive_account_id uuid,
  p_lines jsonb
) returns uuid as $$
declare
  v_transaction_id uuid;
  v_inventory_account_id uuid;
  v_cogs_account_id uuid;
  v_revenue_account_id uuid;
  v_method text;
  v_line jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_sale_price numeric;
  v_total_revenue numeric := 0;
  v_total_cogs numeric := 0;
  v_line_cogs numeric;
  v_remaining_to_consume numeric;
  v_layer record;
  v_consume numeric;
  v_qty_on_hand numeric;
  v_avg_cost numeric;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat penjualan di perusahaan ini';
  end if;
  select inventory_account_id, cogs_account_id, sales_revenue_account_id, inventory_method
    into v_inventory_account_id, v_cogs_account_id, v_revenue_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang / akun Persediaan belum ada';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'Minimal 1 baris barang';
  end if;

  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (p_company_id, p_date, 'penjualan_barang', p_note, p_contact_id, auth.uid())
    returning id into v_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_sale_price := (v_line->>'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Qty tidak valid';
    end if;

    select qty_on_hand, avg_unit_cost into v_qty_on_hand, v_avg_cost from products where id = v_product_id for update;
    if v_qty_on_hand < v_qty then
      raise exception 'Stok tidak cukup untuk salah satu barang (sisa stok: %, diminta: %)', v_qty_on_hand, v_qty;
    end if;

    v_total_revenue := v_total_revenue + (v_qty * v_sale_price);

    if v_method = 'average' then
      v_line_cogs := v_qty * v_avg_cost;
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
        values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_avg_cost, v_line_cogs, p_note);
    else
      -- FIFO: konsumsi layer tertua dulu sampai qty terpenuhi
      v_line_cogs := 0;
      v_remaining_to_consume := v_qty;
      for v_layer in
        select id, qty_remaining, unit_cost from product_stock_layers
        where product_id = v_product_id and qty_remaining > 0
        order by purchase_date asc, created_at asc
        for update
      loop
        exit when v_remaining_to_consume <= 0;
        v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
        update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
        v_line_cogs := v_line_cogs + (v_consume * v_layer.unit_cost);
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note);
        v_remaining_to_consume := v_remaining_to_consume - v_consume;
      end loop;
      if v_remaining_to_consume > 0 then
        raise exception 'Stok FIFO tidak konsisten untuk salah satu barang — hubungi admin';
      end if;
    end if;

    v_total_cogs := v_total_cogs + v_line_cogs;
    update products set qty_on_hand = qty_on_hand - v_qty where id = v_product_id;
  end loop;

  -- Jurnal pendapatan (cuma kalau nominalnya > 0 — lihat constraint journal_entries)
  if v_total_revenue > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, p_receive_account_id, v_total_revenue, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, v_revenue_account_id, 0, v_total_revenue);
  end if;
  -- Jurnal HPP (cuma kalau nominalnya > 0)
  if v_total_cogs > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, v_cogs_account_id, v_total_cogs, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, v_inventory_account_id, 0, v_total_cogs);
  end if;

  return v_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 9. View buat laporan Kartu Persediaan (mutasi + saldo berjalan per barang)
-- ----------------------------------------------------------------------------
create or replace view v_product_card as
select
  pm.id, pm.company_id, pm.product_id, p.code as product_code, p.name as product_name, p.unit,
  pm.date, pm.type, pm.qty, pm.unit_cost, pm.total_cost, pm.note,
  sum(case when pm.type = 'in' then pm.qty else -pm.qty end)
    over (partition by pm.product_id order by pm.date, pm.created_at rows between unbounded preceding and current row) as running_qty,
  sum(case when pm.type = 'in' then pm.total_cost else -pm.total_cost end)
    over (partition by pm.product_id order by pm.date, pm.created_at rows between unbounded preceding and current row) as running_value
from product_movements pm
join products p on p.id = pm.product_id;

alter view v_product_card set (security_invoker = true);
