-- ============================================================================
-- RPC kecil khusus buat update/hapus "Simpan Bukti" (receipt_path) transaksi
-- yang SUDAH ADA, dipakai dari halaman Edit Transaksi. Sengaja dibuat RPC
-- terpisah (bukan update langsung dari client) — cuma nyentuh kolom
-- receipt_path doang, gak ikut ubah baris jurnal, jadi aman dipasangkan ke
-- proses edit transaksi kapan pun tanpa resiko ganggu logic pembukuan.
-- ============================================================================

create or replace function set_transaction_receipt(
  p_transaction_id uuid,
  p_receipt_path text
) returns void as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from transactions where id = p_transaction_id;

  if v_company_id is null then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if not exists (
    select 1 from company_users
    where company_id = v_company_id
      and user_id = auth.uid()
      and role in ('admin', 'staff')
  ) then
    raise exception 'Kamu tidak punya akses untuk mengubah transaksi ini';
  end if;

  update transactions set receipt_path = p_receipt_path where id = p_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;
