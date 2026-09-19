-- ============================================================================
-- PENGUNCIAN FITUR PAKET FREE (bagian 1 dari 2) — sesuai tabel paket yang
-- udah kita susun, sekarang beneran ditegakkan di database, bukan cuma teks
-- di halaman Harga:
--   - Cabang/Cost Center: maks 1 buat paket Free
--   - Transaksi Berulang: gak tersedia sama sekali buat paket Free
-- ============================================================================

create or replace function prevent_cost_center_over_limit() returns trigger as $$
declare
  v_plan text;
  v_count int;
begin
  select plan into v_plan from companies where id = new.company_id;
  select count(*) into v_count from cost_centers where company_id = new.company_id;
  if v_plan = 'free' and v_count >= 1 then
    raise exception 'Paket Free cuma bisa 1 cabang. Upgrade paket buat nambah cabang.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_cost_center_over_limit on cost_centers;
create trigger trg_prevent_cost_center_over_limit
  before insert on cost_centers
  for each row execute function prevent_cost_center_over_limit();

create or replace function prevent_recurring_on_free_plan() returns trigger as $$
declare
  v_plan text;
begin
  select plan into v_plan from companies where id = new.company_id;
  if v_plan = 'free' then
    raise exception 'Transaksi Berulang gak tersedia di paket Free. Upgrade paket buat pakai fitur ini.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_recurring_on_free on recurring_transactions;
create trigger trg_prevent_recurring_on_free
  before insert on recurring_transactions
  for each row execute function prevent_recurring_on_free_plan();
