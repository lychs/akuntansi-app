-- ============================================================================
-- FITUR: Trial 1 bulan buat paket Free. Begitu perusahaan baru dibuat,
-- trial_expires_at otomatis di-set 1 bulan dari sekarang. Kalau plan-nya
-- masih 'free' DAN trial udah lewat, semua percobaan bikin TRANSAKSI BARU
-- bakal ditolak di level database (jadi gak bisa dibypass dari frontend
-- manapun) — tapi data lama tetap bisa dilihat & laporan tetap bisa diakses.
-- ============================================================================

alter table companies add column if not exists trial_expires_at timestamptz;

-- Isi trial_expires_at buat perusahaan yang UDAH ADA (yang belum pernah
-- di-set) — kasih 1 bulan dari SEKARANG (bukan dari tanggal dibuat), biar
-- perusahaan yang udah lama dipakai gak tiba-tiba kekunci pas migrasi ini
-- dijalankan.
update companies set trial_expires_at = now() + interval '1 month'
  where trial_expires_at is null and plan = 'free';

-- Update create_company: perusahaan baru otomatis dapat trial 1 bulan.
-- (Pakai TRIGGER, bukan nulis ulang create_company dari nol — biar gak
-- berisiko ngerusak logic asli pembuatan perusahaan yang udah jalan baik.)
create or replace function set_trial_on_company_insert() returns trigger as $$
begin
  if new.trial_expires_at is null then
    new.trial_expires_at := now() + interval '1 month';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_trial_on_insert on companies;
create trigger trg_set_trial_on_insert
  before insert on companies
  for each row execute function set_trial_on_company_insert();

-- RPC: cek status trial 1 perusahaan (buat ditampilin di banner frontend).
create or replace function get_trial_status(p_company_id uuid)
returns table (plan text, trial_expires_at timestamptz, is_expired boolean, days_left int) as $$
  select
    c.plan, c.trial_expires_at,
    (c.plan = 'free' and c.trial_expires_at is not null and c.trial_expires_at < now()) as is_expired,
    greatest(0, ceil(extract(epoch from (c.trial_expires_at - now())) / 86400)::int) as days_left
  from companies c
  where c.id = p_company_id;
$$ language sql stable security invoker;

-- Trigger: tolak transaksi baru kalau plan masih 'free' DAN trial udah lewat.
create or replace function prevent_transaction_if_trial_expired() returns trigger as $$
declare
  v_plan text;
  v_trial_expires_at timestamptz;
begin
  select plan, trial_expires_at into v_plan, v_trial_expires_at from companies where id = new.company_id;
  if v_plan = 'free' and v_trial_expires_at is not null and v_trial_expires_at < now() then
    raise exception 'Masa trial paket Free perusahaan ini sudah habis. Upgrade paket buat lanjut mencatat transaksi baru — data lama tetap bisa dilihat.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_transaction_trial_expired on transactions;
create trigger trg_prevent_transaction_trial_expired
  before insert on transactions
  for each row execute function prevent_transaction_if_trial_expired();

-- Batasi anggota tim paket Free jadi maksimal 1 (cuma si pemilik).
create or replace function prevent_team_member_over_limit() returns trigger as $$
declare
  v_plan text;
  v_member_count int;
begin
  select plan into v_plan from companies where id = new.company_id;
  select count(*) into v_member_count from company_users where company_id = new.company_id;
  if v_plan = 'free' and v_member_count >= 1 then
    raise exception 'Paket Free cuma bisa 1 anggota tim (pemilik akun). Upgrade paket buat nambah anggota.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_team_over_limit on company_users;
create trigger trg_prevent_team_over_limit
  before insert on company_users
  for each row execute function prevent_team_member_over_limit();
