-- ============================================================================
-- AUDIT TRAIL — mencatat siapa mengubah apa, kapan, di tabel mana
-- ============================================================================
-- Cara kerja: 1 tabel log (audit_logs) + 1 fungsi trigger generik yang bisa
-- dipasang ke tabel manapun. Trigger otomatis nyatet data SEBELUM & SESUDAH
-- perubahan dalam format JSON, jadi gak perlu bikin trigger beda-beda per
-- tabel secara manual.
--
-- PENTING: file ini cuma masang trigger ke tabel-tabel yang saya temukan di
-- file SQL yang di-upload (products, warehouses, projects, cost_centers,
-- departments, manufacturing_boms, production_orders, fiscal_closings,
-- subscription_tokens, company_users, companies). Tabel-tabel INTI seperti
-- journal_entries, accounts, contacts, dan transactions (kalau nama tabelnya
-- itu) TIDAK ketemu strukturnya di file yang saya baca (kemungkinan dibikin
-- lewat Table Editor Supabase langsung, bukan lewat file .sql). Di paling
-- bawah ada template buat kamu tambahin sendiri tabel-tabel itu — tinggal
-- ganti nama_tabel_kamu, gak perlu paham isi trigger-nya.
-- ============================================================================

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete')),
  user_id uuid,
  user_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_company on audit_logs(company_id, created_at desc);
create index if not exists idx_audit_logs_table on audit_logs(table_name, record_id);

alter table audit_logs enable row level security;

drop policy if exists "admin bisa lihat audit log perusahaannya" on audit_logs;
create policy "admin bisa lihat audit log perusahaannya" on audit_logs
  for select using (
    exists (
      select 1 from company_users
      where company_users.company_id = audit_logs.company_id
        and company_users.user_id = auth.uid()
        and company_users.role = 'admin'
    )
  );

-- Insert audit_logs cuma boleh lewat trigger (security definer), bukan langsung
-- dari client, jadi gak perlu policy INSERT untuk role authenticated.

-- ----------------------------------------------------------------------------
-- Fungsi trigger generik
-- ----------------------------------------------------------------------------
create or replace function fn_audit_trigger() returns trigger as $$
declare
  v_company_id uuid;
  v_record_id uuid;
begin
  -- Kasus khusus: tabel 'companies' sendiri, company_id-nya ya id barisnya sendiri
  if TG_TABLE_NAME = 'companies' then
    v_company_id := coalesce(new.id, old.id);
  else
    -- Tabel lain: coba ambil kolom company_id kalau ada
    begin
      v_company_id := coalesce((to_jsonb(new)->>'company_id')::uuid, (to_jsonb(old)->>'company_id')::uuid);
    exception when others then
      v_company_id := null;
    end;
  end if;

  v_record_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);

  insert into audit_logs (company_id, table_name, record_id, action, user_id, user_email, old_data, new_data)
  values (
    v_company_id,
    TG_TABLE_NAME,
    v_record_id,
    lower(TG_OP),
    auth.uid(),
    auth.email(),
    case when TG_OP in ('update','delete') then to_jsonb(old) else null end,
    case when TG_OP in ('insert','update') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- Pasang trigger ke tabel-tabel yang ketemu di file SQL kamu
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'companies', 'company_users', 'products', 'warehouses', 'projects',
    'cost_centers', 'departments', 'manufacturing_boms', 'production_orders',
    'fiscal_closings', 'subscription_tokens', 'manufacturing_bom_items',
    'material_requests', 'material_issues'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists trg_audit_%1$s on %1$s', t);
      execute format('create trigger trg_audit_%1$s after insert or update or delete on %1$s for each row execute function fn_audit_trigger()', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- TEMPLATE: tambahin sendiri buat tabel inti (journal_entries, accounts,
-- contacts, transactions, dst) yang gak ketemu di file yang saya baca.
-- Tinggal ganti 'nama_tabel_kamu', jalankan baris ini per tabel yang mau
-- dilacak (boleh dipasang ke sebanyak apapun tabel):
-- ----------------------------------------------------------------------------
-- drop trigger if exists trg_audit_nama_tabel_kamu on nama_tabel_kamu;
-- create trigger trg_audit_nama_tabel_kamu
--   after insert or update or delete on nama_tabel_kamu
--   for each row execute function fn_audit_trigger();
