-- ============================================================================
-- MIGRASI: Aset otomatis kebentuk dari transaksi pembelian
-- (bukan diinput manual lagi) + generate kode otomatis.
-- Jalankan kapan saja, gak bergantung migrasi Dagang.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Ganti create_transaction: kalau ada baris jurnal yang men-debit akun
-- berkategori 'harta_tetap', otomatis bikinkan baris di tabel "assets" biar
-- muncul di menu Aset (nama aset diambil dari catatan transaksi, kode
-- di-generate otomatis).
-- ----------------------------------------------------------------------------
create or replace function create_transaction(
  p_company_id uuid,
  p_date timestamptz,
  p_type transaction_type,
  p_note text,
  p_contact_id uuid,
  p_lines jsonb
) returns uuid as $$
declare
  v_txn_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric;
  v_category text;
  v_asset_code text;
  v_asset_seq int;
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

    insert into journal_entries (transaction_id, account_id, debit, credit)
    values (
      v_txn_id,
      v_account_id,
      v_debit,
      coalesce((v_line->>'credit')::numeric, 0)
    );

    -- Kalau baris ini men-debit akun kategori "Harta Tetap", otomatis catat
    -- sebagai aset baru — user gak perlu input manual lagi di menu Aset.
    if v_debit > 0 then
      select category into v_category from accounts where id = v_account_id;
      if v_category = 'harta_tetap' then
        select count(*) + 1 into v_asset_seq from assets where company_id = p_company_id;
        v_asset_code := 'AST-' || to_char(p_date, 'YYYYMM') || '-' || lpad(v_asset_seq::text, 3, '0');
        insert into assets (company_id, code, name, account_id, description, acquisition_date, acquisition_cost)
          values (p_company_id, v_asset_code, coalesce(nullif(trim(p_note), ''), 'Aset ' || v_asset_code), v_account_id, p_note, p_date::date, v_debit);
      end if;
    end if;
  end loop;

  return v_txn_id;
end;
$$ language plpgsql security invoker;
