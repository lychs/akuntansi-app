-- ============================================================================
-- PERBAIKAN: redeem_subscription_token (dipanggil CUSTOMER dari halaman
-- Billing pas nebus kode token) bakal gagal, soalnya tabel subscription_tokens
-- cuma punya izin (RLS) buat platform admin doang — customer biasa gak
-- pernah dikasih izin UPDATE ke tabel itu, padahal fungsi ini PERLU nge-UPDATE
-- baris token (nandain "sudah ditebus"). Fungsi ini udah ngecek sendiri hak
-- akses lewat is_company_editor(), jadi aman dijadiin security definer biar
-- bisa nembus pembatasan RLS itu buat operasi internalnya doang.
-- ============================================================================

create or replace function redeem_subscription_token(p_company_id uuid, p_code text)
returns void as $$
declare
  v_token record;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini';
  end if;

  select * into v_token from subscription_tokens
    where code = upper(trim(p_code)) and is_active = true and used_by is null
    for update;
  if v_token is null then
    raise exception 'Kode token tidak valid atau sudah pernah dipakai';
  end if;

  update subscription_tokens
    set used_by = auth.uid(), used_company_id = p_company_id, used_at = now()
    where id = v_token.id;

  update companies
    set plan = v_token.plan,
        plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + (v_token.duration_months || ' months')::interval
    where id = p_company_id;
end;
$$ language plpgsql security definer set search_path = public;
