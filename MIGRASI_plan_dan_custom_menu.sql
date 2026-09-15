-- ============================================================================
-- FONDASI: 4 tingkat paket (Free/Basic/Pro/Corporate) + kemampuan custom menu
-- khusus buat perusahaan berpaket Corporate. Menu custom-nya diatur oleh KAMU
-- (platform admin) lewat halaman internal, BUKAN self-service oleh klien —
-- sesuai kesepakatan kita.
-- ============================================================================

-- Paket berlangganan tiap perusahaan (defaultnya 'free' buat semua yang udah ada)
alter table companies add column if not exists plan text not null default 'free'
  check (plan in ('free','basic','pro','corporate'));

-- Config menu custom — cuma dipakai kalau plan = 'corporate'. Isinya daftar
-- KEY section/menu yang mau disembunyikan (key-nya sama persis dengan yang
-- dipakai di Sidebar.jsx, misal 'sectionDagang', 'reportOpex', dst).
alter table companies add column if not exists hidden_menu_keys text[] default '{}';

-- Tandai akun platform admin (yang boleh atur custom menu perusahaan lain).
-- Cuma kamu yang perlu di-set true di sini — dijalankan manual, bukan
-- otomatis, biar gak ada yang bisa self-assign jadi admin.
alter table profiles add column if not exists is_platform_admin boolean not null default false;

-- GANTI EMAIL DI BAWAH INI SESUAI AKUN KAMU, baru jalankan baris ini:
-- update profiles set is_platform_admin = true
--   where id = (select id from auth.users where email = 'ramadhanisiregar019@gmail.com');

-- RPC: cek apakah user yang login sekarang adalah platform admin (dipakai di
-- frontend buat nyembunyiin/nampilin menu admin).
create or replace function is_platform_admin() returns boolean as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$ language sql stable security invoker;

-- RPC: update plan + hidden_menu_keys 1 perusahaan (cuma platform admin yang boleh).
create or replace function admin_set_company_plan(
  p_company_id uuid, p_plan text, p_hidden_menu_keys text[]
) returns void as $$
begin
  if not is_platform_admin() then
    raise exception 'Cuma platform admin yang boleh melakukan ini';
  end if;
  update companies set plan = p_plan, hidden_menu_keys = coalesce(p_hidden_menu_keys, '{}')
  where id = p_company_id;
end;
$$ language plpgsql security invoker;

-- RPC: daftar semua perusahaan buat halaman admin (nama + plan saat ini).
create or replace function admin_list_companies() returns table (
  id uuid, name text, business_type text, plan text, hidden_menu_keys text[]
) as $$
  select c.id, c.name, c.category, c.plan, c.hidden_menu_keys
  from companies c
  where is_platform_admin()
  order by c.name;
$$ language sql stable security invoker;
