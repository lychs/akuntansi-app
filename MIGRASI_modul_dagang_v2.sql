-- ============================================================================
-- MIGRASI TAMBAHAN #2: Metode "Identifikasi Khusus" + fitur Stock Opname
-- Jalankan SETELAH MIGRASI_modul_dagang.sql (yang pertama) berhasil.
-- Supabase → SQL Editor → New Query → paste semua → Run.
-- Aman dijalankan berkali-kali.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Izinkan nilai baru 'specific' di kolom inventory_method
-- ----------------------------------------------------------------------------
alter table companies drop constraint if exists companies_inventory_method_check;
alter table companies add constraint companies_inventory_method_check
  check (inventory_method in ('fifo', 'average', 'specific'));

-- ----------------------------------------------------------------------------
-- 2. Akun baru: "Selisih Stok Opname" — dipakai buat catat selisih pas stock
--    opname (barang hilang/rusak jadi beban, barang lebih jadi pengurang beban).
-- ----------------------------------------------------------------------------
alter table companies add column if not exists opname_variance_account_id uuid references accounts(id);

-- Bikinin akun ini buat company Dagang yang SUDAH ada tapi belum punya akun ini
-- (misalnya yang dibuat sebelum migrasi ini ada).
do $$
declare
  v_company record;
  v_account_id uuid;
begin
  for v_company in select id from companies where business_type = 'dagang' and opname_variance_account_id is null
  loop
    insert into accounts (company_id, code, name, category, normal_balance, description, is_locked)
      values (v_company.id, '5-51500', 'Selisih Stok Opname', 'beban_operasional', 'debit', 'Akun selisih otomatis untuk stock opname', true)
      on conflict (company_id, code) do nothing
      returning id into v_account_id;
    if v_account_id is not null then
      update companies set opname_variance_account_id = v_account_id where id = v_company.id;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Ganti create_company: kalau dagang, sekalian bikin akun Selisih Stok Opname
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
  v_variance_account_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Nama perusahaan tidak boleh kosong';
  end if;
  if p_business_type not in ('jasa', 'dagang', 'manufaktur') then
    raise exception 'Jenis usaha tidak valid';
  end if;
  if p_business_type = 'dagang' and p_inventory_method not in ('fifo', 'average', 'specific') then
    raise exception 'Metode persediaan wajib dipilih (FIFO, Rata-rata, atau Identifikasi Khusus) untuk usaha dagang';
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
    insert into accounts (company_id, code, name, category, normal_balance, description, is_locked)
      values (v_company_id, '5-51500', 'Selisih Stok Opname', 'beban_operasional', 'debit', 'Akun selisih otomatis untuk stock opname', true)
      returning id into v_variance_account_id;

    update companies set
      inventory_account_id = v_inventory_account_id,
      cogs_account_id = v_cogs_account_id,
      sales_revenue_account_id = v_revenue_account_id,
      opname_variance_account_id = v_variance_account_id
    where id = v_company_id;
  end if;

  return v_company_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 4. Ganti record_sale: tambah dukungan metode 'specific' (Identifikasi Khusus)
--    — untuk metode ini, tiap baris WAJIB sertakan "layer_id" (unit/batch mana
--    yang persis terjual), bukan otomatis dari yang paling lama kayak FIFO.
--    p_lines: [{ "product_id", "qty", "sale_price", "layer_id" (wajib kalau specific) }]
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
  v_layer_id uuid;
  v_layer_qty numeric;
  v_layer_cost numeric;
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

    elsif v_method = 'specific' then
      -- Identifikasi Khusus: user WAJIB pilih layer/unit persis mana yang terjual
      v_layer_id := (v_line->>'layer_id')::uuid;
      if v_layer_id is null then
        raise exception 'Metode Identifikasi Khusus butuh pilihan unit/batch spesifik per baris';
      end if;
      select qty_remaining, unit_cost into v_layer_qty, v_layer_cost
        from product_stock_layers where id = v_layer_id and product_id = v_product_id for update;
      if v_layer_qty is null or v_layer_qty < v_qty then
        raise exception 'Unit/batch yang dipilih gak punya sisa cukup untuk qty ini';
      end if;
      update product_stock_layers set qty_remaining = qty_remaining - v_qty where id = v_layer_id;
      v_line_cogs := v_qty * v_layer_cost;
      insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
        values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_qty, v_layer_cost, v_line_cogs, p_note);

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

  if v_total_revenue > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, p_receive_account_id, v_total_revenue, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit)
      values (v_transaction_id, v_revenue_account_id, 0, v_total_revenue);
  end if;
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
-- 5. RPC: get_available_layers — daftar batch/unit yang masih ada sisa stoknya
--    buat satu produk (dipakai frontend nampilin pilihan di metode Identifikasi
--    Khusus).
-- ----------------------------------------------------------------------------
create or replace function get_available_layers(p_product_id uuid)
returns table (id uuid, purchase_date date, qty_remaining numeric, unit_cost numeric) as $$
  select id, purchase_date, qty_remaining, unit_cost
  from product_stock_layers
  where product_id = p_product_id and qty_remaining > 0
  order by purchase_date asc, created_at asc;
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 6. RPC: record_stock_opname — samakan catatan sistem dengan hasil hitung fisik.
--    p_lines: [{ "product_id": "...", "counted_qty": 47, "unit_cost": 5000 (opsional,
--    cuma dipakai kalau ada barang LEBIH dan produk itu belum pernah punya harga
--    pokok sama sekali) }]
--    Efeknya: barang KURANG (counted < sistem) → jadi Beban Selisih Stok Opname.
--             barang LEBIH (counted > sistem) → jadi pengurang Beban (kredit),
--             persediaan bertambah.
-- ----------------------------------------------------------------------------
create or replace function record_stock_opname(
  p_company_id uuid,
  p_date timestamptz,
  p_note text,
  p_lines jsonb
) returns uuid as $$
declare
  v_transaction_id uuid;
  v_inventory_account_id uuid;
  v_variance_account_id uuid;
  v_method text;
  v_line jsonb;
  v_product_id uuid;
  v_counted_qty numeric;
  v_manual_unit_cost numeric;
  v_qty_on_hand numeric;
  v_avg_cost numeric;
  v_diff numeric;
  v_total_shortage_cost numeric := 0;
  v_total_overage_value numeric := 0;
  v_line_cost numeric;
  v_remaining_to_consume numeric;
  v_layer record;
  v_consume numeric;
  v_any_line boolean := false;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat mencatat stock opname di perusahaan ini';
  end if;
  select inventory_account_id, opname_variance_account_id, inventory_method
    into v_inventory_account_id, v_variance_account_id, v_method
    from companies where id = p_company_id;
  if v_inventory_account_id is null then
    raise exception 'Perusahaan ini belum diset sebagai usaha Dagang';
  end if;

  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_date, 'penyesuaian', p_note, auth.uid())
    returning id into v_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_counted_qty := (v_line->>'counted_qty')::numeric;
    v_manual_unit_cost := nullif(v_line->>'unit_cost', '')::numeric;

    select qty_on_hand, avg_unit_cost into v_qty_on_hand, v_avg_cost from products where id = v_product_id for update;
    v_diff := v_counted_qty - v_qty_on_hand;
    if v_diff = 0 then
      continue;
    end if;
    v_any_line := true;

    if v_diff < 0 then
      -- Barang KURANG dari catatan sistem (hilang/rusak/susut)
      v_remaining_to_consume := abs(v_diff);
      v_line_cost := 0;
      if v_method = 'average' then
        v_line_cost := v_remaining_to_consume * v_avg_cost;
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_remaining_to_consume, v_avg_cost, v_line_cost, p_note);
      else
        -- FIFO & Identifikasi Khusus: konsumsi layer tertua (specific tanpa pilihan
        -- unit eksplisit di sini karena ini penyesuaian selisih, bukan penjualan)
        for v_layer in
          select id, qty_remaining, unit_cost from product_stock_layers
          where product_id = v_product_id and qty_remaining > 0
          order by purchase_date asc, created_at asc
          for update
        loop
          exit when v_remaining_to_consume <= 0;
          v_consume := least(v_remaining_to_consume, v_layer.qty_remaining);
          update product_stock_layers set qty_remaining = qty_remaining - v_consume where id = v_layer.id;
          v_line_cost := v_line_cost + (v_consume * v_layer.unit_cost);
          insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
            values (p_company_id, v_product_id, v_transaction_id, p_date, 'out', v_consume, v_layer.unit_cost, v_consume * v_layer.unit_cost, p_note);
          v_remaining_to_consume := v_remaining_to_consume - v_consume;
        end loop;
      end if;
      v_total_shortage_cost := v_total_shortage_cost + v_line_cost;
      update products set qty_on_hand = v_counted_qty where id = v_product_id;

    else
      -- Barang LEBIH dari catatan sistem (ditemukan lebih banyak dari yang tercatat)
      declare
        v_unit_cost numeric := coalesce(v_manual_unit_cost, nullif(v_avg_cost, 0));
      begin
        if v_unit_cost is null then
          raise exception 'Produk ini belum punya harga pokok — isi "unit_cost" manual buat baris selisih lebih';
        end if;
        insert into product_stock_layers (company_id, product_id, purchase_date, qty_remaining, unit_cost, transaction_id)
          values (p_company_id, v_product_id, p_date::date, v_diff, v_unit_cost, v_transaction_id);
        insert into product_movements (company_id, product_id, transaction_id, date, type, qty, unit_cost, total_cost, note)
          values (p_company_id, v_product_id, v_transaction_id, p_date, 'in', v_diff, v_unit_cost, v_diff * v_unit_cost, p_note);
        v_total_overage_value := v_total_overage_value + (v_diff * v_unit_cost);
        if v_method = 'average' then
          update products set
            avg_unit_cost = case when v_counted_qty > 0 then ((v_qty_on_hand * v_avg_cost) + (v_diff * v_unit_cost)) / v_counted_qty else 0 end,
            qty_on_hand = v_counted_qty
          where id = v_product_id;
        else
          update products set qty_on_hand = v_counted_qty where id = v_product_id;
        end if;
      end;
    end if;
  end loop;

  if not v_any_line then
    raise exception 'Gak ada selisih stok — semua qty hasil hitung fisik sudah sama dengan catatan sistem';
  end if;

  -- Jurnal: selisih bersih (kekurangan jadi beban, kelebihan mengurangi beban itu)
  if v_total_shortage_cost > v_total_overage_value then
    declare v_net numeric := v_total_shortage_cost - v_total_overage_value; begin
      insert into journal_entries (transaction_id, account_id, debit, credit)
        values (v_transaction_id, v_variance_account_id, v_net, 0);
      insert into journal_entries (transaction_id, account_id, debit, credit)
        values (v_transaction_id, v_inventory_account_id, 0, v_net);
    end;
  elsif v_total_overage_value > v_total_shortage_cost then
    declare v_net numeric := v_total_overage_value - v_total_shortage_cost; begin
      insert into journal_entries (transaction_id, account_id, debit, credit)
        values (v_transaction_id, v_inventory_account_id, v_net, 0);
      insert into journal_entries (transaction_id, account_id, debit, credit)
        values (v_transaction_id, v_variance_account_id, 0, v_net);
    end;
  end if;

  return v_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;
