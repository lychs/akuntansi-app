-- ============================================================================
-- MIGRASI TAMBAHAN #6: Template Akun (COA) default otomatis
-- Perusahaan baru gak lagi mulai dari kosong — begitu dibuat, otomatis kebikin
-- daftar akun standar sesuai jenis usahanya (Jasa atau Dagang), dikunci (🔒)
-- biar gak sengaja kehapus, tapi tetap bisa ditambah akun baru di atasnya.
-- Jalankan SETELAH semua migrasi modul Dagang sebelumnya (#1, #2).
-- Ini menggantikan definisi create_company yang sebelumnya lagi (aman, semua
-- perilaku lama tetap ada, cuma ditambah bagian seed COA di akhir).
-- ============================================================================

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

  -- ---- Template COA dasar, sama buat semua jenis usaha ----
  insert into accounts (company_id, code, name, category, normal_balance, is_locked) values
    (v_company_id, '1-10001', 'Kas', 'kas_bank', 'debit', true),
    (v_company_id, '1-10002', 'Bank', 'kas_bank', 'debit', true),
    (v_company_id, '1-10010', 'Piutang Usaha', 'piutang', 'debit', true),
    (v_company_id, '1-10020', 'Beban Dibayar Dimuka', 'harta_lancar_lainnya', 'debit', true),
    (v_company_id, '1-20001', 'Peralatan', 'harta_tetap', 'debit', true),
    (v_company_id, '1-20002', 'Akumulasi Penyusutan Peralatan', 'harta_tetap', 'kredit', true),
    (v_company_id, '2-10001', 'Hutang Usaha', 'hutang', 'kredit', true),
    (v_company_id, '2-10002', 'Hutang Pajak', 'hutang', 'kredit', true),
    (v_company_id, '3-10001', 'Modal Pemilik', 'modal', 'kredit', true),
    (v_company_id, '5-10001', 'Beban Gaji', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10002', 'Beban Sewa', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10003', 'Beban Listrik, Air & Internet', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10004', 'Beban Perlengkapan', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10005', 'Beban Penyusutan', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10006', 'Beban Lain-lain', 'beban_operasional', 'debit', true);

  if p_business_type = 'jasa' then
    insert into accounts (company_id, code, name, category, normal_balance, is_locked) values
      (v_company_id, '4-10001', 'Pendapatan Jasa', 'pendapatan', 'kredit', true);
  end if;

  if p_business_type = 'dagang' then
    -- Akun khusus Dagang yang RPC lain (record_purchase/record_sale) butuh
    -- referensinya langsung, jadi dibuat terpisah & disimpan id-nya ke companies.
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

    -- Akun tambahan khas usaha dagang (di luar 4 akun wajib di atas)
    insert into accounts (company_id, code, name, category, normal_balance, is_locked) values
      (v_company_id, '5-10007', 'Beban Angkut Penjualan', 'beban_operasional', 'debit', true);

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
