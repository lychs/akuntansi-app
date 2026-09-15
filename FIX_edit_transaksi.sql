-- ============================================================================
-- FITUR BARU: Edit Transaksi (untuk jenis transaksi "sederhana" aja — General,
-- Penyesuaian, Pemasukan, Pengeluaran, Tanam Modal, Tarik Modal, Transfer).
-- Transaksi Dagang (Pembelian/Penjualan/Retur/dll) & Hutang/Piutang BELUM bisa
-- diedit lewat sini karena ada efek samping ke stok/saldo hutang-piutang yang
-- butuh penanganan lebih hati-hati — itu tetap dihapus & dicatat ulang.
-- ============================================================================

create or replace function update_transaction_simple(
  p_transaction_id uuid, p_date timestamptz, p_note text, p_contact_id uuid, p_lines jsonb
) returns void as $$
declare
  v_company_id uuid;
  v_type transaction_type;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_simple_types transaction_type[] := array['general','penyesuaian','pemasukan','pengeluaran','tanam_modal','tarik_modal','transfer']::transaction_type[];
begin
  select company_id, type into v_company_id, v_type from transactions where id = p_transaction_id;
  if v_company_id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if not (v_type = any(v_simple_types)) then
    raise exception 'Jenis transaksi ini belum bisa diedit lewat sini — hapus & catat ulang buat transaksi Dagang/Hutang/Piutang';
  end if;
  if exists (select 1 from fiscal_closings where company_id = v_company_id and closing_date >= p_date::date) then
    raise exception 'Tanggal ini sudah masuk periode yang ditutup buku — gak bisa diedit';
  end if;

  update transactions set date = p_date, note = p_note, contact_id = p_contact_id where id = p_transaction_id;
  delete from journal_entries where transaction_id = p_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    insert into journal_entries (transaction_id, account_id, debit, credit) values (p_transaction_id, v_account_id, v_debit, v_credit);
  end loop;
end;
$$ language plpgsql security invoker;

-- RPC buat ambil detail 1 transaksi (dipakai buat isi form Edit).
create or replace function get_transaction_detail(p_transaction_id uuid)
returns table (
  id uuid, date timestamptz, type text, note text, contact_id uuid,
  account_id uuid, account_code text, account_name text, debit numeric, credit numeric
) as $$
  select t.id, t.date, t.type::text, t.note, t.contact_id,
    a.id, a.code, a.name, je.debit, je.credit
  from transactions t
  join journal_entries je on je.transaction_id = t.id
  join accounts a on a.id = je.account_id
  where t.id = p_transaction_id
  order by je.debit desc;
$$ language sql stable security invoker;

-- RPC buat hapus transaksi sederhana (dipakai kalau user pilih hapus daripada edit).
create or replace function delete_transaction_simple(p_transaction_id uuid) returns void as $$
declare
  v_company_id uuid;
  v_type transaction_type;
  v_simple_types transaction_type[] := array['general','penyesuaian','pemasukan','pengeluaran','tanam_modal','tarik_modal','transfer']::transaction_type[];
begin
  select company_id, type into v_company_id, v_type from transactions where id = p_transaction_id;
  if v_company_id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if not is_company_editor(v_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if not (v_type = any(v_simple_types)) then
    raise exception 'Jenis transaksi ini belum bisa dihapus lewat sini';
  end if;
  delete from transactions where id = p_transaction_id;
end;
$$ language plpgsql security invoker;
