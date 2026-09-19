-- ============================================================================
-- MIGRASI TAMBAHAN #7: Termin Pembayaran (Hutang/Piutang) + Akun Pajak & Bunga
-- Jalankan SETELAH migrasi v6 (template COA default).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ganti create_company: tambah akun pajak & bunga standar ke template COA
--    (berlaku untuk semua jenis usaha, karena pajak & bunga bisa kena di usaha
--    apa aja, bukan cuma dagang).
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

  -- ---- Template COA dasar, sama buat semua jenis usaha ----
  insert into accounts (company_id, code, name, category, normal_balance, is_locked) values
    (v_company_id, '1-10001', 'Kas', 'kas_bank', 'debit', true),
    (v_company_id, '1-10002', 'Bank', 'kas_bank', 'debit', true),
    (v_company_id, '1-10010', 'Piutang Usaha', 'piutang', 'debit', true),
    (v_company_id, '1-10020', 'Beban Dibayar Dimuka', 'harta_lancar_lainnya', 'debit', true),
    (v_company_id, '1-10030', 'PPN Masukan', 'harta_lancar_lainnya', 'debit', true),
    (v_company_id, '1-10040', 'PPh Dibayar Dimuka', 'harta_lancar_lainnya', 'debit', true),
    (v_company_id, '1-20001', 'Peralatan', 'harta_tetap', 'debit', true),
    (v_company_id, '1-20002', 'Akumulasi Penyusutan Peralatan', 'harta_tetap', 'kredit', true),
    (v_company_id, '2-10001', 'Hutang Usaha', 'hutang', 'kredit', true),
    (v_company_id, '2-10010', 'PPN Keluaran', 'hutang', 'kredit', true),
    (v_company_id, '2-10021', 'Hutang PPh 21', 'hutang', 'kredit', true),
    (v_company_id, '2-10023', 'Hutang PPh 23', 'hutang', 'kredit', true),
    (v_company_id, '2-10024', 'Hutang PPh Final', 'hutang', 'kredit', true),
    (v_company_id, '3-10001', 'Modal Pemilik', 'modal', 'kredit', true),
    (v_company_id, '4-10002', 'Pendapatan Bunga', 'pendapatan', 'kredit', true),
    (v_company_id, '5-10001', 'Beban Gaji', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10002', 'Beban Sewa', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10003', 'Beban Listrik, Air & Internet', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10004', 'Beban Perlengkapan', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10005', 'Beban Penyusutan', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10006', 'Beban Lain-lain', 'beban_operasional', 'debit', true),
    (v_company_id, '5-10008', 'Beban Bunga', 'beban_operasional', 'debit', true);

  if p_business_type = 'jasa' then
    insert into accounts (company_id, code, name, category, normal_balance, is_locked) values
      (v_company_id, '4-10001', 'Pendapatan Jasa', 'pendapatan', 'kredit', true);
  end if;

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

-- ----------------------------------------------------------------------------
-- 2. Ganti create_transaction: tambah dukungan "termin pembayaran" — kalau
--    jenis transaksinya Hutang/Piutang dan ada kontak + tanggal jatuh tempo,
--    otomatis kecatat juga di tabel receivables_payables (supaya muncul di
--    Laporan Hutang Piutang & notifikasi jatuh tempo di Dashboard — sebelumnya
--    cuma "Saldo Awal Hutang Piutang" yang tercatat di situ, transaksi Hutang/
--    Piutang biasa dari menu Transaksi TIDAK pernah masuk laporan itu).
-- ----------------------------------------------------------------------------
create or replace function create_transaction(
  p_company_id uuid,
  p_date timestamptz,
  p_type transaction_type,
  p_note text,
  p_contact_id uuid,
  p_lines jsonb,
  p_due_date date default null,
  p_invoice_no text default null
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

  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (p_company_id, p_date, p_type, p_note, p_contact_id, auth.uid())
    returning id into v_txn_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);

    insert into journal_entries (transaction_id, account_id, debit, credit)
    values (v_txn_id, v_account_id, v_debit, v_credit);

    select category into v_category from accounts where id = v_account_id;

    -- Aset tetap otomatis (fitur sebelumnya, tetap dipertahankan)
    if v_debit > 0 and v_category = 'harta_tetap' then
      select count(*) + 1 into v_asset_seq from assets where company_id = p_company_id;
      v_asset_code := 'AST-' || to_char(p_date, 'YYYYMM') || '-' || lpad(v_asset_seq::text, 3, '0');
      insert into assets (company_id, code, name, account_id, description, acquisition_date, acquisition_cost)
        values (p_company_id, v_asset_code, coalesce(nullif(trim(p_note), ''), 'Aset ' || v_asset_code), v_account_id, p_note, p_date::date, v_debit);
    end if;

    -- Hutang/Piutang otomatis tercatat ke receivables_payables (fitur baru)
    -- supaya muncul di Laporan Hutang Piutang & pengingat jatuh tempo.
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
