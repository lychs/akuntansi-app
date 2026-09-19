-- ============================================================================
-- Batas jumlah perusahaan per AKUN (bukan per perusahaan), sesuai paket:
--   Free/Basic = maks 1 perusahaan total per akun
--   Pro/Corporate = tanpa batas
--
-- Karena kolom `plan` disimpan PER PERUSAHAAN (bukan per akun/profile), "plan
-- akun" ditentukan dari plan TERTINGGI di antara semua perusahaan yang akun
-- ini jadi admin/pemiliknya. Begitu salah satu perusahaan di-upgrade ke Pro
-- (lewat token), akun itu otomatis kebuka buat nambah perusahaan baru lagi.
--
-- Perusahaan PERTAMA selalu boleh dibuat (gak mungkin diblokir), karena
-- perusahaan baru selalu mulai dari plan='free' secara default.
-- ============================================================================

create or replace function prevent_company_over_limit() returns trigger as $$
declare
  v_owned_count int;
  v_highest_plan text;
  v_plan_rank int;
begin
  -- Hitung berapa perusahaan yang akun ini SUDAH jadi admin/pemiliknya
  select count(*) into v_owned_count
  from company_users
  where user_id = auth.uid() and role = 'admin';

  -- Perusahaan pertama selalu boleh, gak perlu cek apa-apa
  if v_owned_count = 0 then
    return new;
  end if;

  -- Cari plan tertinggi di antara perusahaan yang sudah dimiliki akun ini
  select c.plan into v_highest_plan
  from company_users cu
  join companies c on c.id = cu.company_id
  where cu.user_id = auth.uid() and cu.role = 'admin'
  order by case c.plan
    when 'corporate' then 4
    when 'pro' then 3
    when 'basic' then 2
    else 1
  end desc
  limit 1;

  v_plan_rank := case v_highest_plan when 'pro' then 3 when 'corporate' then 4 else 1 end;

  -- Free/Basic (rank 1/2) maks 1 perusahaan total; Pro/Corporate (rank 3/4) tanpa batas
  if v_plan_rank < 3 then
    raise exception 'Akun kamu di paket % — maksimal 1 perusahaan per akun. Upgrade salah satu perusahaan ke Pro buat nambah perusahaan baru.', initcap(coalesce(v_highest_plan, 'free'));
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_prevent_company_over_limit on companies;
create trigger trg_prevent_company_over_limit
  before insert on companies
  for each row execute function prevent_company_over_limit();
