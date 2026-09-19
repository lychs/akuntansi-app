-- ============================================================================
-- PERBAIKAN 1: Batas anggota tim sekarang per-paket, bukan cuma Free:
--   Free = 1, Basic = 2, Pro/Corporate = tanpa batas
-- ============================================================================

create or replace function prevent_team_member_over_limit() returns trigger as $$
declare
  v_plan text;
  v_member_count int;
  v_limit int;
begin
  select plan into v_plan from companies where id = new.company_id;
  select count(*) into v_member_count from company_users where company_id = new.company_id;

  v_limit := case v_plan when 'free' then 1 when 'basic' then 2 else null end;

  if v_limit is not null and v_member_count >= v_limit then
    raise exception 'Paket % cuma bisa maksimal % anggota tim. Upgrade paket buat nambah anggota.', initcap(v_plan), v_limit;
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- PERBAIKAN 2: Perusahaan tipe Manufaktur TIDAK dapat trial 1 bulan sama
-- sekali (langsung dianggap trial habis sejak dibuat) — Manufaktur cuma
-- boleh dipakai beneran kalau udah upgrade ke Pro/Corporate (lewat token).
-- Perusahaan tetap BISA dibuat & dilihat-lihat (read-only), cuma gak bisa
-- input transaksi baru sampai plan-nya di-upgrade — ini reuse mekanisme
-- trial-expired yang udah ada, gak perlu logic baru.
-- ============================================================================

create or replace function set_trial_on_company_insert() returns trigger as $$
declare
  v_already_used boolean;
begin
  if new.business_type = 'manufaktur' then
    new.trial_expires_at := now();
    return new;
  end if;

  select (trial_used_at is not null) into v_already_used from profiles where id = auth.uid();

  if coalesce(v_already_used, false) then
    new.trial_expires_at := now();
  else
    new.trial_expires_at := now() + interval '1 month';
    update profiles set trial_used_at = now() where id = auth.uid();
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
