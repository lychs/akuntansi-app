-- ============================================================================
-- FITUR 1: Token Langganan Gratis — kamu bikin kode token (masa berlaku
-- sekian bulan/tahun, paket tertentu), siapapun yang punya kode itu bisa
-- "tebus" di menu Billing buat langsung naik paket gratis.
-- ============================================================================

create table if not exists subscription_tokens (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  plan            text not null check (plan in ('basic','pro','corporate')),
  duration_months int not null check (duration_months > 0),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  used_by         uuid references auth.users(id),
  used_company_id uuid references companies(id),
  used_at         timestamptz,
  is_active       boolean not null default true
);
alter table subscription_tokens enable row level security;

drop policy if exists "platform admin manages tokens" on subscription_tokens;
create policy "platform admin manages tokens" on subscription_tokens
  for all using (is_platform_admin()) with check (is_platform_admin());

-- Perlu policy TERPISAH biar user BIASA (bukan admin) tetap bisa nge-CEK kode
-- token yang mereka masukin (tapi cuma buat token yang aktif & belum kepake —
-- gak bisa lihat token orang lain / yang udah kepake).
drop policy if exists "anyone can check unused active token" on subscription_tokens;
create policy "anyone can check unused active token" on subscription_tokens
  for select using (is_active = true and used_by is null);

-- Company perlu tau plan-nya berlaku sampai kapan (dari token yang ditebus).
alter table companies add column if not exists plan_expires_at timestamptz;

-- RPC: admin generate token baru.
create or replace function admin_generate_token(p_plan text, p_duration_months int)
returns text as $$
declare
  v_code text;
begin
  if not is_platform_admin() then
    raise exception 'Cuma platform admin yang boleh melakukan ini';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  insert into subscription_tokens (code, plan, duration_months, created_by)
    values (v_code, p_plan, p_duration_months, auth.uid());
  return v_code;
end;
$$ language plpgsql security invoker;

-- RPC: daftar semua token buat halaman admin.
create or replace function admin_list_tokens() returns table (
  id uuid, code text, plan text, duration_months int, created_at timestamptz,
  used_by_email text, used_company_name text, used_at timestamptz, is_active boolean
) as $$
  select t.id, t.code, t.plan, t.duration_months, t.created_at,
    u.email, c.name, t.used_at, t.is_active
  from subscription_tokens t
  left join auth.users u on u.id = t.used_by
  left join companies c on c.id = t.used_company_id
  where is_platform_admin()
  order by t.created_at desc;
$$ language sql stable security invoker;

-- RPC: tebus token — siapapun yang jadi editor/owner di 1 perusahaan bisa
-- masukin kode buat naikin paket perusahaan itu.
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
$$ language plpgsql security invoker;

-- ============================================================================
-- FITUR 3: Profil Perusahaan diperluas — Periode Akuntansi, Tanggal Mulai
-- Pembukuan, Lokasi Bisnis, NPWP (kalau Indonesia)/Tax ID (lokasi lain),
-- Mata Uang Utama, Kontak (telepon & email perusahaan).
-- ============================================================================

alter table companies add column if not exists financial_year_start_month int not null default 1
  check (financial_year_start_month between 1 and 12);
alter table companies add column if not exists bookkeeping_start_date date;
alter table companies add column if not exists business_location text not null default 'Indonesia';
alter table companies add column if not exists tax_id text;
alter table companies add column if not exists base_currency text not null default 'IDR';
alter table companies add column if not exists company_phone text;
alter table companies add column if not exists company_email text;

-- Trigger: tolak transaksi yang tanggalnya SEBELUM Tanggal Mulai Pembukuan
-- perusahaan (kalau di-set). Ini beda dari fiscal_closings (yang ngunci
-- periode yang UDAH ditutup) — ini ngunci sebelum titik mulai pembukuan.
create or replace function prevent_transaction_before_start_date() returns trigger as $$
declare
  v_start_date date;
begin
  select bookkeeping_start_date into v_start_date from companies where id = new.company_id;
  if v_start_date is not null and new.date::date < v_start_date then
    raise exception 'Tanggal transaksi (%) lebih awal dari Tanggal Mulai Pembukuan perusahaan (%)', new.date::date, v_start_date;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_before_start_date on transactions;
create trigger trg_prevent_before_start_date
  before insert or update on transactions
  for each row execute function prevent_transaction_before_start_date();
