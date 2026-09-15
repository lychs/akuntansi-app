-- ============================================================================
-- PERBAIKAN: Trial 1 bulan sekarang dibatasi PER AKUN (bukan per perusahaan).
-- Begitu 1 akun pernah nikmatin trial (di perusahaan manapun), perusahaan
-- BARU yang dibikin akun yang sama gak dapat trial baru lagi — langsung
-- dianggap "trial habis" sejak awal (read-only, gak bisa catat transaksi
-- baru sampai upgrade/tebus token).
-- ============================================================================

-- Tandain di profil user: kapan pertama kali mereka "makan" jatah trial.
alter table profiles add column if not exists trial_used_at timestamptz;

-- Backfill: akun yang udah punya perusahaan Free ber-trial sekarang, dianggap
-- udah "pernah pakai" trial-nya (biar gak dapet trial baru lagi kalau bikin
-- perusahaan baru setelah migrasi ini).
update profiles p
set trial_used_at = now()
where trial_used_at is null
  and exists (
    select 1 from company_users cu
    join companies c on c.id = cu.company_id
    where cu.user_id = p.id and cu.role = 'admin' and c.plan = 'free' and c.trial_expires_at is not null
  );

-- Ganti trigger: cek dulu apakah AKUN yang bikin perusahaan ini udah pernah
-- pakai trial sebelumnya (di perusahaan lain). Kalau udah pernah, perusahaan
-- baru ini gak dapat trial (trial_expires_at = sekarang, langsung "habis").
-- Kalau belum pernah, ini trial pertama mereka — kasih 1 bulan penuh, dan
-- tandain di profil biar gak kepake dua kali.
create or replace function set_trial_on_company_insert() returns trigger as $$
declare
  v_already_used boolean;
begin
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

drop trigger if exists trg_set_trial_on_insert on companies;
create trigger trg_set_trial_on_insert
  before insert on companies
  for each row execute function set_trial_on_company_insert();
