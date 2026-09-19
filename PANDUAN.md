# Panduan Setup dari Awal — Software Akuntansi

Semua kode di project ini sudah saya buat & test (build production-nya sukses, schema
database sudah saya jalankan beneran di Postgres dan lolos semua test). Bagian yang
harus KAMU lakukan sendiri adalah langkah-langkah yang butuh akun/login kamu.

---

## Langkah 1 — Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → Sign up (bisa pakai GitHub/Google)
2. Klik **New Project**
3. Isi nama project (mis. "akuntansi-app"), buat password database yang kuat (**simpan
   passwordnya**, bakal kepake kalau nanti mau akses DB langsung via psql)
4. Pilih region terdekat (Singapore biasanya paling cepat buat Indonesia)
5. Tunggu ~2 menit sampai project selesai di-provision

## Langkah 2 — Jalankan Schema Database

1. Di dashboard Supabase project kamu, buka menu **SQL Editor** (ikon di sidebar kiri)
2. Klik **New query**
3. Buka file `schema.sql` yang saya buat, copy semua isinya, paste ke SQL Editor
4. Klik **Run** (atau Ctrl+Enter) — harusnya sukses semua ("Success. No rows returned")
5. Cek di menu **Table Editor**, harusnya sudah muncul tabel: `companies`, `accounts`,
   `contacts`, `assets`, `transactions`, `journal_entries`, `receivables_payables`, dst.

## Langkah 3 — Setup Auth (Login)

Project ini pakai login email+password (paling simpel buat mulai). Supabase Auth sudah
aktif otomatis, gak perlu setting tambahan. Kalau nanti mau tambah "Login dengan Google"
(seperti Akuntansiku), tinggal ke **Authentication → Providers → Google**, aktifkan, dan
isi Client ID/Secret dari Google Cloud Console — bisa kita bahas nanti kalau sudah siap.

## Langkah 4 — Ambil API Key

1. Di dashboard Supabase, buka **Settings → API Keys**
2. Cari tab **Publishable and secret API keys**
3. Kalau belum ada, klik **Create new API keys** dulu
4. Copy:
   - **Project URL** (di bagian atas halaman Settings → API, formatnya
     `https://xxxxx.supabase.co`)
   - **Publishable key** (formatnya `sb_publishable_...`) — ini yang aman dipakai di
     kode frontend (browser), BUKAN yang "secret key"

## Langkah 5 — Buat Company Pertama & Daftar Diri Sendiri

Karena app ini multi-tenant, kamu perlu 1 baris di tabel `companies` dan 1 baris di
`company_users` yang menghubungkan akun kamu ke company itu.

1. Jalankan project ini dulu di lokal (Langkah 7) atau langsung buka halaman **Login**
   yang sudah dideploy, klik **Daftar**, buat akun dengan email+password kamu
2. Cek email untuk konfirmasi akun (Supabase kirim email verifikasi otomatis)
3. Balik ke Supabase Dashboard → **Table Editor → companies** → Insert row → isi
   `name` = nama perusahaan kamu (mis. "Bali Nata Parama") → Save
4. Buka **Authentication → Users**, copy **User UID** akun yang baru kamu daftarkan
5. Buka **Table Editor → company_users** → Insert row:
   - `company_id` = id company yang barusan dibuat (copy dari tabel companies)
   - `user_id` = User UID dari langkah 4
   - `role` = `admin`
6. Login ke app, company kamu harusnya sudah muncul di dropdown Dashboard

## Langkah 6 — Isi COA (Chart of Accounts) Otomatis

Saya sudah generate `seed_coa.sql` dari 165 akun yang ada di file
`Software_Akuntansi_2026.xlsm` kamu, lengkap kategori & normal balance-nya.

1. Buka **SQL Editor** di Supabase lagi
2. Buka file `seed_coa.sql`, copy isinya
3. Ganti SEMUA `:'company_id'` jadi UUID company kamu (dari Langkah 5), pakai tanda
   kutip satu, contoh: `'a1b2c3d4-....'`
4. Run — 165 akun harusnya langsung ke-insert

## Langkah 7 — Jalankan di Lokal (opsional, buat coba dulu sebelum deploy)

```bash
cd akuntansi-app
npm install
cp .env.example .env
```

Edit `.env`, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` dari Langkah 4.

```bash
npm run dev
```

Buka `http://localhost:5173`, coba daftar/login, pilih company, coba Tambah Transaksi.

## Langkah 8 — Push ke GitHub

Netlify deploy paling gampang lewat koneksi ke Git repo (auto-deploy tiap kamu push).

```bash
cd akuntansi-app
git init
git add .
git commit -m "Initial commit: akuntansi app"
```

Buat repo baru di [github.com/new](https://github.com/new) (jangan centang "Add
README", biar gak konflik), lalu:

```bash
git remote add origin https://github.com/USERNAME/akuntansi-app.git
git branch -M main
git push -u origin main
```

## Langkah 9 — Deploy ke Netlify

1. Login ke [app.netlify.com](https://app.netlify.com)
2. **Add new site → Import an existing project → Deploy with GitHub**
3. Pilih repo `akuntansi-app` yang barusan kamu push
4. Netlify otomatis detect build command (`npm run build`) & publish directory
   (`dist`) dari file `netlify.toml` yang sudah saya siapkan — biarin default
5. **Sebelum klik Deploy**, buka **Add environment variables**, tambahkan:
   - `VITE_SUPABASE_URL` = (dari Langkah 4)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (dari Langkah 4)
6. Klik **Deploy site**
7. Tunggu ~1-2 menit, situs kamu sudah live di URL `xxxxx.netlify.app`

Kalau kamu sudah punya site Netlify existing (bukan bikin baru): buka site itu →
**Site configuration → Environment variables** → tambahkan 2 variable di atas →
**Site configuration → Build & deploy** → hubungkan ke repo GitHub ini → Deploy.

## Langkah 10 — Test End-to-End

1. Buka URL Netlify kamu
2. Login pakai akun yang sudah didaftarkan ke company (Langkah 5)
3. Ke halaman Transaksi, coba input: Jenis = Pemasukan, Debit = akun Kas, Kredit =
   akun Pendapatan, isi nominal & catatan → Simpan
4. Balik ke Dashboard, saldo akun Kas harusnya langsung update

---

## Yang Belum Ada di Versi Ini (Next Steps)

Supaya starter-nya gak kebesaran & bisa langsung kamu jalankan hari ini, saya sengaja
belum masukin:
- Auto-link ke `receivables_payables` waktu pilih jenis transaksi Hutang/Piutang di
  form Tambah Transaksi (schema-nya sudah siap — tabel & trigger pembayarannya jalan —
  tinggal extend fungsi `create_transaction` supaya juga insert baris di
  `receivables_payables`)
- Tombol "Bayar" di halaman Laporan → Hutang Piutang untuk mencatat pelunasan cicilan
- Halaman edit/hapus untuk Akun/Aset/Kontak (sekarang baru bisa tambah + lihat list;
  edit/hapus masih lewat Supabase Table Editor langsung)
- Login Google
- KPI dashboard bergaya kartu dengan grafik tren (dashboard sekarang baru tabel saldo
  polos)

Kabari saya kalau Langkah 1-10 sudah jalan lancar — kita lanjut ke bagian mana yang
paling kamu butuhkan duluan.

---

## UPDATE 2: Onboarding + Redesain Dashboard (Sidebar & KPI Card)

### Yang berubah
- **Onboarding otomatis**: begitu login pertama kali dan belum terhubung ke company
  manapun, sekarang muncul layar "Isi Data Perusahaan" di dalam app — gak perlu lagi
  buka Supabase Table Editor manual untuk bikin company + company_users.
- **Layout baru**: sidebar kiri (menggantikan navbar atas), dengan submenu Transaksi/
  Master Data/Laporan yang bisa expand/collapse, plus header atas berisi company
  switcher & tombol Keluar.
- **Dashboard dirombak total**: kartu sambutan, 4 KPI card dengan tren % vs bulan lalu
  (Pendapatan, Pengeluaran, Laba Bersih, Piutang), grafik keuangan 6 bulan terakhir
  (bar + line chart), tabel Transaksi Terbaru, Tagihan Jatuh Tempo, dan Ringkasan Kas
  per akun.

### Langkah tambahan wajib: update database dulu

Karena ada 1 fungsi baru di database (`create_company`, dipakai layar onboarding),
kamu perlu jalankan SQL tambahan ini dulu di Supabase **sebelum** update kode frontend:

1. Buka **SQL Editor** di Supabase → New query
2. Paste ini, lalu **Run**:

```sql
create or replace function create_company(p_name text) returns uuid as $$
declare
  v_company_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Nama perusahaan tidak boleh kosong';
  end if;
  insert into companies (name) values (trim(p_name)) returning id into v_company_id;
  insert into company_users (company_id, user_id, role) values (v_company_id, auth.uid(), 'admin');
  return v_company_id;
end;
$$ language plpgsql security definer set search_path = public;
```

(File `schema.sql` yang saya kasih juga sudah saya update dengan fungsi ini, jadi kalau
kamu setup dari nol lagi di masa depan, tinggal jalankan `schema.sql` versi baru, gak
perlu tambahan manual ini lagi.)

### Update kode frontend

Sama seperti update sebelumnya:
1. Backup `.env` kamu
2. Extract zip baru, timpa/pindah ke folder baru
3. Pasang lagi `.env`
4. `npm install` (ada 2 library baru: `lucide-react` buat icon, `recharts` buat grafik)
5. `npm run dev`, refresh browser

Push ke GitHub lagi kalau sudah oke di lokal — Netlify otomatis re-deploy.

---

## UPDATE 4: Import Akun/Aset/Kontak, Saldo Awal, Penyesuaian, Format Angka, Penyusutan Aset

### Yang berubah
- **Import via Excel** untuk Akun (COA), Aset, dan Kontak (sebelumnya cuma Transaksi)
- **Atur Saldo Awal** — tombol baru di Master Data → Akun (COA), buat set saldo awal
  akun apapun per tanggal tertentu. Otomatis di-plug ke akun ekuitas "Saldo Awal" (dibuat
  sendiri oleh sistem) supaya Neraca tetap balance.
- **Saldo Awal Hutang Piutang** — submenu baru di Master Data, buat catat saldo awal
  hutang/piutang per kontak beserta tanggal & jatuh tempo.
- **Jenis Transaksi baru: "Penyesuaian (Adjustment)"** di form Tambah Transaksi — buat
  koreksi/penyesuaian jurnal bebas (debit/kredit akun apapun).
- **Format angka pakai titik ribuan** (1.000.000) di semua kolom nominal — Tambah
  Transaksi, Biaya Akuisisi Aset, Saldo Awal.
- **Penyusutan Aset**: sekarang ada field "Kapan Mulai Disusutkan", "Masa Manfaat
  (bulan)", dan "Nilai Residu" saat tambah aset. Kalau sudah mulai disusutkan, kolom
  "Nilai Buku" di tabel otomatis terhitung (metode garis lurus), gak akan pernah minus
  dari nilai residu.

### Langkah wajib: update database dulu

Buka **SQL Editor** di Supabase → New query → paste semua SQL di bawah ini sekaligus → **Run**:

```sql
-- 1. Tambah jenis transaksi baru
alter type transaction_type add value if not exists 'penyesuaian';
alter type transaction_type add value if not exists 'saldo_awal';

-- 2. Tambah kolom penyusutan di tabel assets
alter table assets add column if not exists depreciation_start_date date;
alter table assets add column if not exists useful_life_months smallint;
alter table assets add column if not exists salvage_value numeric(18,2) not null default 0;

-- 3. Fungsi helper: akun ekuitas "Saldo Awal" otomatis per company
create or replace function get_or_create_opening_balance_account(p_company_id uuid) returns uuid as $$
declare
  v_id uuid;
begin
  select id into v_id from accounts where company_id = p_company_id and code = '3-30099';
  if v_id is null then
    insert into accounts (company_id, code, name, category, normal_balance, is_locked, description)
    values (p_company_id, '3-30099', 'Saldo Awal', 'modal', 'kredit', true,
            'Akun penyeimbang otomatis untuk input saldo awal akun & hutang piutang')
    returning id into v_id;
  end if;
  return v_id;
end;
$$ language plpgsql security invoker;

-- 4. RPC: set saldo awal 1 akun
create or replace function set_account_opening_balance(
  p_company_id uuid, p_account_id uuid, p_amount numeric, p_date date, p_note text default 'Saldo Awal'
) returns uuid as $$
declare
  v_txn_id uuid;
  v_ob_account uuid;
  v_normal normal_balance;
begin
  if not is_company_member(p_company_id) then
    raise exception 'Bukan anggota company ini';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Nominal saldo awal harus lebih dari 0';
  end if;
  select normal_balance into v_normal from accounts where id = p_account_id and company_id = p_company_id;
  if v_normal is null then
    raise exception 'Akun tidak ditemukan';
  end if;
  v_ob_account := get_or_create_opening_balance_account(p_company_id);

  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_date, 'saldo_awal', p_note, auth.uid())
    returning id into v_txn_id;

  if v_normal = 'debit' then
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, p_amount, 0), (v_txn_id, v_ob_account, 0, p_amount);
  else
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, 0, p_amount), (v_txn_id, v_ob_account, p_amount, 0);
  end if;

  return v_txn_id;
end;
$$ language plpgsql security invoker;

-- 5. RPC: set saldo awal Hutang/Piutang per kontak
create or replace function set_opening_ar_ap(
  p_company_id uuid, p_contact_id uuid, p_type receivable_payable_type,
  p_account_id uuid, p_amount numeric, p_date date, p_due_date date default null,
  p_note text default null, p_invoice_no text default null
) returns uuid as $$
declare
  v_txn_id uuid;
  v_ob_account uuid;
  v_rp_id uuid;
begin
  if not is_company_member(p_company_id) then
    raise exception 'Bukan anggota company ini';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0';
  end if;
  v_ob_account := get_or_create_opening_balance_account(p_company_id);

  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (p_company_id, p_date, 'saldo_awal', coalesce(p_note, 'Saldo Awal ' || p_type), p_contact_id, auth.uid())
    returning id into v_txn_id;

  if p_type = 'piutang' then
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, p_amount, 0), (v_txn_id, v_ob_account, 0, p_amount);
  else
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, 0, p_amount), (v_txn_id, v_ob_account, p_amount, 0);
  end if;

  insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount)
    values (p_company_id, v_txn_id, p_contact_id, p_type, p_invoice_no, p_date, p_due_date, p_amount)
    returning id into v_rp_id;

  return v_rp_id;
end;
$$ language plpgsql security invoker;
```

**Catatan soal `alter type ... add value`**: kalau muncul error "unsafe use of new value" pas nyoba dipakai di query LAIN dalam satu Run yang sama — itu batasan normal Postgres (nilai enum baru gak boleh langsung dipakai di transaksi yang sama saat dia dibuat). Solusinya: jalankan bagian `alter type` (langkah 1) dulu sendirian, klik Run, BARU lanjut jalankan sisanya (langkah 2-5) di query terpisah.

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`, `npm run dev`.

---

## UPDATE 5: Search, Notifikasi, Avatar, Nama Profil + Perbaikan Keamanan

### Yang berubah
- **Search bar di header** — cari akun (COA) & kontak secara real-time, klik hasil langsung lompat ke halaman itu dengan filter otomatis
- **Notifikasi (lonceng)** — beneran ambil data tagihan piutang yang jatuh tempo dalam 7 hari ke depan (bukan hiasan), badge angka merah kalau ada yang perlu diperhatikan
- **Avatar inisial** — lingkaran ungu berisi 2 huruf inisial dari nama kamu (jujur: ini bukan foto asli, karena upload foto profil belum kita bangun)
- **Nama profil bisa diubah** — klik dropdown user → "Ubah Nama", nanti tampil di header gantiin email
- **Tema warna** — brass/emas diganti ungu-biru (senada logo baru)

### ⚠️ Perbaikan keamanan penting

Waktu bangun fitur nama profil ini, saya ketemu **celah keamanan nyata**: tabel `profiles` dari awal gak punya proteksi (RLS) sama sekali — artinya siapapun yang login berpotensi bisa lihat/ubah data nama semua user lain, bukan cuma miliknya sendiri. Saya sudah **test langsung** dan pastikan perbaikannya bener-bener nutup celah itu (user A dites gagal total pas coba ubah data user B).

**WAJIB jalankan SQL ini di Supabase SQL Editor sebelum update kode frontend:**

```sql
alter table profiles enable row level security;
create policy "user can view own profile" on profiles for select using (id = auth.uid());
create policy "user can insert own profile" on profiles for insert with check (id = auth.uid());
create policy "user can update own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
```

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`, `npm run dev`.



---

## UPDATE 3: Form Perusahaan Lengkap + Multi-Perusahaan per Akun

### Yang berubah
- **Form onboarding lebih lengkap**: sekarang ada Logo Usaha (upload), Nama Perusahaan,
  Kategori Usaha, Nama Usaha, Bidang Usaha — bukan cuma nama doang.
- **1 akun bisa punya banyak perusahaan**: ada menu baru "+ Tambah Perusahaan" di
  dropdown user (pojok kanan atas, klik nama email kamu). Perusahaan yang baru
  ditambah otomatis jadi pilihan aktif & muncul di dropdown company switcher.

### Langkah tambahan wajib di Supabase

**A. Jalankan SQL tambahan** (SQL Editor → New query → paste → Run):

```sql
alter table companies add column if not exists business_name text;
alter table companies add column if not exists category text;
alter table companies add column if not exists business_field text;
alter table companies add column if not exists logo_url text;

create or replace function create_company(
  p_name text,
  p_business_name text default null,
  p_category text default null,
  p_business_field text default null,
  p_logo_url text default null
) returns uuid as $$
declare
  v_company_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Nama perusahaan tidak boleh kosong';
  end if;
  insert into companies (name, business_name, category, business_field, logo_url)
    values (trim(p_name), nullif(trim(p_business_name),''), p_category, p_business_field, p_logo_url)
    returning id into v_company_id;
  insert into company_users (company_id, user_id, role) values (v_company_id, auth.uid(), 'admin');
  return v_company_id;
end;
$$ language plpgsql security definer set search_path = public;
```

**B. Buat Storage Bucket untuk logo** (WAJIB, gak bisa cuma lewat SQL — Supabase minta
dibuat lewat Dashboard untuk bucket baru):

1. Di Supabase Dashboard, buka menu **Storage** di sidebar kiri
2. Klik **New bucket**
3. Nama: `company-logos` (harus persis ini)
4. Aktifkan toggle **Public bucket** (biar logo bisa langsung tampil tanpa perlu login)
5. Klik **Create bucket**
6. Setelah bucket dibuat, jalankan SQL ini juga di SQL Editor (buat aturan siapa yang boleh upload):

```sql
create policy "user can upload logo ke folder sendiri" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "siapapun bisa lihat logo company (bucket publik)" on storage.objects
  for select using (bucket_id = 'company-logos');
```

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`,
`npm run dev`.



---

## UPDATE: Semua Menu Sudah Ditambahkan

Setelah setup awal kamu berhasil, saya tambahkan semua halaman sesuai peta menu di
`Rancangan_Software_Akuntansi.md`:

**Master Data** → Akun (COA), Aset, Kontak — masing-masing ada list + form tambah baru.

**Laporan** → Transaksi, Jurnal, Buku Besar (pilih akun + filter periode), Neraca Saldo,
Laba Rugi, Neraca (per tanggal, otomatis cek Aset = Hutang + Modal), Hutang Piutang
(dikelompokkan per kontak dengan status Lunas/Pending/Overdue), Beban Operasional.

**Transaksi** → Import via Excel ditambahkan (format sama seperti template yang kamu
kasih: Tanggal, Kode Akun, Akun, Debit, Credit, Catatan — baris tanpa tanggal dianggap
lanjutan transaksi yang sama, maksimal 100 transaksi per file).

Semua menu ini sudah muncul di navigasi atas (dropdown "Transaksi", "Master Data",
"Laporan"), dan semuanya sudah dites bisa di-build tanpa error.

### Cara update project kamu yang sudah jalan

Karena kamu sudah setup Supabase (schema, COA, company, login) — **tidak perlu diulang
sama sekali**. Cukup update kode frontend-nya saja:

1. Download zip project yang baru ini
2. **Backup dulu** file `.env` kamu yang sekarang (copy ke luar folder, atau catat
   isinya) — soalnya kalau kamu extract zip baru menimpa folder lama, `.env` biasanya
   ikut ketimpa/hilang kalau kamu extract dengan opsi "replace all"
3. Extract zip baru ini, timpa folder `akuntansi-app` yang lama
4. Pastikan file `.env` masih ada isinya (kalau hilang, buat ulang dari `.env.example`,
   isi lagi dengan Project URL & Publishable Key kamu)
5. Buka terminal di folder itu, jalankan:
   ```bash
   npm install
   npm run dev
   ```
   (perlu `npm install` lagi karena ada 1 library baru — `xlsx` — buat baca file Excel)
6. Refresh browser, coba klik-klik menu baru di navigasi atas

Kalau semua lancar di lokal, tinggal push ke GitHub lagi (`git add . && git commit -m
"tambah semua menu" && git push`) — Netlify otomatis re-deploy kalau kamu sudah
menghubungkannya sebelumnya (Langkah 9).


---

## UPDATE 6: Splash Screen Logo Baru, Animasi Menu, Profil Perusahaan

### Yang berubah
- **Splash screen** sekarang pakai logo baru kamu (bukan infinity loop lama)
- **Animasi**: tiap pindah halaman ada efek fade-in halus, dan tombol menu di sidebar ada efek "tertekan" pas diklik
- **Menu baru: Profil Perusahaan** (Master Data → Profil Perusahaan) — edit nama, kategori, bidang usaha, dan logo perusahaan yang aktif. **Cuma admin** yang bisa ubah (staff biasa akan ditolak sistem)

### Langkah wajib: update database dulu

Jalankan SQL ini di Supabase (SQL Editor → New query → Run):

```sql
create policy "admin can update own company" on companies
  for update using (
    exists (select 1 from company_users where company_id = companies.id and user_id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from company_users where company_id = companies.id and user_id = auth.uid() and role = 'admin')
  );
```

Ini sudah saya **test langsung**: admin berhasil update profil perusahaan, staff biasa yang coba update **ditolak total** (0 baris berubah).

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`, `npm run dev`.

---

## UPDATE 7: Perbaikan Background + Menu Tutup Buku Akhir Tahun

### Perbaikan background
Ketemu bug nyata: ada 2 aturan `body {}` di CSS, yang belakangan nimpa gradasi elegan jadi warna
polos. Sudah diperbaiki + gradasinya sekarang ditaruh langsung di area konten (bukan cuma `body`)
biar pasti kelihatan, dan opacity-nya dinaikkan.

### Menu baru: Tutup Buku Akhir Tahun (Master Data)
- Menolkan saldo semua akun Pendapatan & Beban periode berjalan, mindahin laba/rugi bersihnya ke
  akun otomatis "Laba Ditahan"
- Setelah ditutup, sistem **menolak otomatis** input transaksi baru ke tanggal yang udah ditutup
- Cuma admin yang bisa melakukan ini
- Sudah saya **test end-to-end** di database: transaksi 10jt pendapatan + 4jt beban → tutup buku →
  Laba Ditahan tepat 6jt, saldo Pendapatan/Beban balik nol, transaksi ke tanggal lama ditolak,
  transaksi ke tanggal baru tetap bisa, dan tutup buku mundur (ke tanggal lebih awal) ditolak juga.

### Langkah wajib: update database dulu

Jalankan SQL ini di Supabase (SQL Editor → New query → Run) — **cukup panjang, copy semua sekaligus**:

```sql
create table fiscal_closings (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  closing_date   date not null,
  net_income     numeric(18,2) not null,
  transaction_id uuid not null references transactions(id),
  note           text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (company_id, closing_date)
);
alter table fiscal_closings enable row level security;
create policy "member can view fiscal closings" on fiscal_closings
  for select using (is_company_member(company_id));
create policy "admin can insert fiscal closings" on fiscal_closings
  for insert with check (
    exists (select 1 from company_users where company_id = fiscal_closings.company_id and user_id = auth.uid() and role = 'admin')
  );

create or replace function prevent_transaction_before_closing() returns trigger as $$
declare
  v_last_closing date;
begin
  select max(closing_date) into v_last_closing from fiscal_closings where company_id = new.company_id;
  if v_last_closing is not null and new.date::date <= v_last_closing then
    raise exception 'Tanggal % sudah ditutup buku (tutup buku terakhir: %). Gak bisa input transaksi baru di periode yang sudah ditutup.',
      new.date::date, v_last_closing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_prevent_transaction_before_closing
  before insert on transactions
  for each row execute function prevent_transaction_before_closing();

create or replace function close_fiscal_year(p_company_id uuid, p_closing_date date, p_note text default null) returns uuid as $$
declare
  v_is_admin boolean;
  v_last_closing date;
  v_start date;
  v_txn_id uuid;
  v_retained_account uuid;
  v_net_income numeric := 0;
  v_amt numeric;
  v_row record;
begin
  select exists(
    select 1 from company_users where company_id = p_company_id and user_id = auth.uid() and role = 'admin'
  ) into v_is_admin;
  if not v_is_admin then
    raise exception 'Cuma admin yang bisa melakukan tutup buku';
  end if;

  select max(closing_date) into v_last_closing from fiscal_closings where company_id = p_company_id;
  if v_last_closing is not null and p_closing_date <= v_last_closing then
    raise exception 'Tanggal tutup buku harus setelah tutup buku terakhir (%)', v_last_closing;
  end if;
  v_start := coalesce(v_last_closing + 1, '1900-01-01'::date);

  select id into v_retained_account from accounts where company_id = p_company_id and code = '3-30098';
  if v_retained_account is null then
    insert into accounts (company_id, code, name, category, normal_balance, is_locked, description)
    values (p_company_id, '3-30098', 'Laba Ditahan', 'modal', 'kredit', true,
            'Akumulasi laba/rugi dari periode yang sudah ditutup buku')
    returning id into v_retained_account;
  end if;

  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_closing_date, 'penyesuaian', coalesce(p_note, 'Tutup Buku Akhir Periode'), auth.uid())
    returning id into v_txn_id;

  for v_row in
    select a.id, a.normal_balance,
      coalesce(sum(je.debit),0) as total_debit, coalesce(sum(je.credit),0) as total_credit
    from accounts a
    left join journal_entries je on je.account_id = a.id
    left join transactions t on t.id = je.transaction_id and t.date >= v_start and t.date <= p_closing_date
    where a.company_id = p_company_id and a.category in ('pendapatan','beban_pokok','beban_operasional')
    group by a.id, a.normal_balance
    having coalesce(sum(je.debit),0) <> 0 or coalesce(sum(je.credit),0) <> 0
  loop
    if v_row.normal_balance = 'kredit' then
      v_amt := v_row.total_credit - v_row.total_debit;
      if v_amt > 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, v_amt, 0);
      elsif v_amt < 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, 0, -v_amt);
      end if;
      v_net_income := v_net_income + v_amt;
    else
      v_amt := v_row.total_debit - v_row.total_credit;
      if v_amt > 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, 0, v_amt);
      elsif v_amt < 0 then
        insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_row.id, -v_amt, 0);
      end if;
      v_net_income := v_net_income - v_amt;
    end if;
  end loop;

  if v_net_income > 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_retained_account, 0, v_net_income);
  elsif v_net_income < 0 then
    insert into journal_entries (transaction_id, account_id, debit, credit) values (v_txn_id, v_retained_account, -v_net_income, 0);
  end if;

  insert into fiscal_closings (company_id, closing_date, net_income, transaction_id, note, created_by)
    values (p_company_id, p_closing_date, v_net_income, v_txn_id, p_note, auth.uid());

  return v_txn_id;
end;
$$ language plpgsql security invoker set search_path = public;
```

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`, `npm run dev`,
lalu **hard refresh** browser (Ctrl+Shift+R) buat mastiin CSS lama gak ke-cache.

---

## UPDATE 8: Perbaikan Bug Simpan Profil, Logo di Header, Kelola Akses (Owner/Editor/Viewer)

### 1. Bug "gak bisa simpan Profil Perusahaan" — DIPERBAIKI
Penyebabnya: Supabase kadang menolak UPDATE secara diam-diam (gara-gara RLS) TANPA memberi error
ke kode JS — jadi sebelumnya app "mengira" berhasil padahal nggak ada yang berubah. Sekarang app
mengecek beneran apakah datanya berubah, dan kasih tau jelas kalau gagal.

### 2. Logo perusahaan tampil di header
Sekarang logo perusahaan aktif tampil kecil di sebelah nama/dropdown company di header —
biar langsung ketauan kalau perubahan logo di Profil Perusahaan beneran tersimpan.

### 3. Menu baru: Kelola Akses (Master Data → Kelola Akses)
- Owner bisa **undang orang lain via email** dengan peran Owner/Editor/Viewer
- Kalau yang diundang belum pernah login dengan email itu, undangan otomatis "nempel" begitu dia
  login pertama kali
- Owner bisa ubah peran anggota atau keluarkan anggota
- **Catatan jujur**: peran Viewer saat ini baru bersifat informasi/label — sistem belum menahan
  Viewer secara teknis dari mengubah data di semua halaman (itu proyek terpisah yang lebih besar,
  karena berarti nulis ulang aturan keamanan di hampir semua tabel). Kabari saya kalau itu memang
  dibutuhkan, saya bisa lanjutkan.

### 🐛 Bug serius ketemu & diperbaiki: infinite recursion di RLS
Saat testing, saya menemukan desain awal saya untuk policy "admin bisa lihat semua anggota" bikin
Postgres error "infinite recursion" — karena policy di tabel `company_users` mengecek ulang tabel
`company_users` itu sendiri secara langsung. Sudah diperbaiki pakai fungsi khusus
(`is_company_admin`) yang aman dari masalah ini, dan saya **test 7 skenario keamanan berbeda** —
semua lolos: undang anggota, terima otomatis, ubah peran, non-admin ditolak mengundang/mengubah
peran diri sendiri, dst.

### Langkah wajib: update database dulu

```sql
alter table company_users add column if not exists email text;

create or replace function is_company_admin(p_company_id uuid) returns boolean as $$
  select exists (
    select 1 from company_users
    where company_id = p_company_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "admin can update own company" on companies;
create policy "admin can update own company" on companies
  for update using (is_company_admin(id)) with check (is_company_admin(id));

create policy "admin can view all company members" on company_users
  for select using (is_company_admin(company_id));
create policy "admin can update member roles" on company_users
  for update using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy "admin can remove members" on company_users
  for delete using (is_company_admin(company_id));

create table company_invitations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  email        text not null,
  role         company_role not null default 'staff',
  invited_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
alter table company_invitations enable row level security;
create policy "admin can manage invitations" on company_invitations
  for all using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy "invited user can view own invitations" on company_invitations
  for select using (lower(email) = lower(auth.email()));

create or replace function invite_to_company(p_company_id uuid, p_email text, p_role company_role) returns uuid as $$
declare
  v_inv_id uuid;
begin
  if not is_company_admin(p_company_id) then
    raise exception 'Cuma Owner yang bisa mengundang anggota baru';
  end if;
  if p_email is null or trim(p_email) = '' then
    raise exception 'Email tidak boleh kosong';
  end if;
  if exists (select 1 from company_users cu join auth.users u on u.id = cu.user_id
             where cu.company_id = p_company_id and lower(u.email) = lower(trim(p_email))) then
    raise exception 'User dengan email ini sudah jadi anggota perusahaan';
  end if;

  select id into v_inv_id from company_invitations
    where company_id = p_company_id and lower(email) = lower(trim(p_email)) and accepted_at is null;
  if v_inv_id is not null then
    update company_invitations set role = p_role, invited_by = auth.uid(), created_at = now() where id = v_inv_id;
  else
    insert into company_invitations (company_id, email, role, invited_by)
      values (p_company_id, lower(trim(p_email)), p_role, auth.uid())
      returning id into v_inv_id;
  end if;
  return v_inv_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function accept_pending_invitations() returns integer as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in select * from company_invitations where lower(email) = lower(auth.email()) and accepted_at is null
  loop
    insert into company_users (company_id, user_id, role, email)
      values (v_row.company_id, auth.uid(), v_row.role, auth.email())
      on conflict (company_id, user_id) do nothing;
    update company_invitations set accepted_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public;
```

**Penting**: kalau kamu sebelumnya sudah pernah membuat company secara manual lewat Table Editor
(bukan lewat form onboarding), baris `company_users` kamu kemungkinan `email`-nya kosong. Ini gak
masalah untuk fungsinya, cuma nanti di halaman Kelola Akses akan muncul "(email belum tercatat)"
untuk baris itu — isi manual aja lewat Table Editor kalau mau rapi:
```sql
update company_users set email = 'emailmu@gmail.com' where user_id = 'USER_ID_KAMU';
```

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`, `npm run dev`.

---

## UPDATE 9: Viewer Sekarang Beneran Read-Only (Bukan Cuma Label)

Sesuai janji di update sebelumnya — sekarang peran **Viewer** benar-benar dikunci secara teknis
di seluruh aplikasi, bukan cuma label doang.

### Yang berubah
- **Backend (database)**: semua tabel utama (Akun, Kontak, Aset, Transaksi, Jurnal, Hutang
  Piutang) sekarang punya aturan terpisah — SELECT (baca) boleh semua anggota termasuk Viewer,
  tapi INSERT/UPDATE/DELETE (tulis) cuma boleh Owner & Editor
- **RPC penulisan data** (`create_transaction`, `set_account_opening_balance`,
  `set_opening_ar_ap`) sekarang kasih pesan error jelas ke Viewer: "Cuma Owner atau Editor yang
  bisa melakukan ini"
- **Frontend**: semua tombol "+ Tambah", form input, dan halaman Import sekarang otomatis
  disembunyikan buat Viewer, diganti dengan notice penjelasan — jadi Viewer gak buang waktu isi
  form yang bakal ditolak
- **Tutup Buku**: sekarang khusus Owner aja (Editor pun gak boleh)

### 🐛 Bug serius ketemu & diperbaiki lagi: infinite recursion (kedua kalinya)
Pas testing, desain awal saya lagi-lagi kena masalah "infinite recursion" di RLS — kali ini di
skala lebih besar. Sudah diperbaiki dengan pola yang sama (fungsi `is_company_editor` yang aman),
dan saya **test 5 skenario nyata**: Viewer bisa baca semua data, ditolak insert langsung ke tabel,
ditolak lewat RPC, ditolak update — semua sesuai harapan. Editor tetap bisa kerja normal.

### Langkah wajib: update database dulu

```sql
create or replace function is_company_editor(p_company_id uuid) returns boolean as $$
  select exists (
    select 1 from company_users
    where company_id = p_company_id and user_id = auth.uid() and role in ('admin','staff')
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "member can manage accounts" on accounts;
create policy "member can view accounts" on accounts for select using (is_company_member(company_id));
create policy "editor can insert accounts" on accounts for insert with check (is_company_editor(company_id));
create policy "editor can update accounts" on accounts for update using (is_company_editor(company_id)) with check (is_company_editor(company_id));
create policy "editor can delete accounts" on accounts for delete using (is_company_editor(company_id));

drop policy if exists "member can manage contacts" on contacts;
create policy "member can view contacts" on contacts for select using (is_company_member(company_id));
create policy "editor can insert contacts" on contacts for insert with check (is_company_editor(company_id));
create policy "editor can update contacts" on contacts for update using (is_company_editor(company_id)) with check (is_company_editor(company_id));
create policy "editor can delete contacts" on contacts for delete using (is_company_editor(company_id));

drop policy if exists "member can manage assets" on assets;
create policy "member can view assets" on assets for select using (is_company_member(company_id));
create policy "editor can insert assets" on assets for insert with check (is_company_editor(company_id));
create policy "editor can update assets" on assets for update using (is_company_editor(company_id)) with check (is_company_editor(company_id));
create policy "editor can delete assets" on assets for delete using (is_company_editor(company_id));

drop policy if exists "member can manage transactions" on transactions;
create policy "member can view transactions" on transactions for select using (is_company_member(company_id));
create policy "editor can insert transactions" on transactions for insert with check (is_company_editor(company_id));
create policy "editor can update transactions" on transactions for update using (is_company_editor(company_id)) with check (is_company_editor(company_id));
create policy "editor can delete transactions" on transactions for delete using (is_company_editor(company_id));

drop policy if exists "member can manage journal_entries" on journal_entries;
create policy "member can view journal_entries" on journal_entries for select using (
  exists (select 1 from transactions t where t.id = transaction_id and is_company_member(t.company_id)));
create policy "editor can insert journal_entries" on journal_entries for insert with check (
  exists (select 1 from transactions t where t.id = transaction_id and is_company_editor(t.company_id)));
create policy "editor can update journal_entries" on journal_entries for update using (
  exists (select 1 from transactions t where t.id = transaction_id and is_company_editor(t.company_id))) with check (
  exists (select 1 from transactions t where t.id = transaction_id and is_company_editor(t.company_id)));
create policy "editor can delete journal_entries" on journal_entries for delete using (
  exists (select 1 from transactions t where t.id = transaction_id and is_company_editor(t.company_id)));

drop policy if exists "member can manage receivables_payables" on receivables_payables;
create policy "member can view receivables_payables" on receivables_payables for select using (is_company_member(company_id));
create policy "editor can insert receivables_payables" on receivables_payables for insert with check (is_company_editor(company_id));
create policy "editor can update receivables_payables" on receivables_payables for update using (is_company_editor(company_id)) with check (is_company_editor(company_id));
create policy "editor can delete receivables_payables" on receivables_payables for delete using (is_company_editor(company_id));

drop policy if exists "member can manage receivable_payments" on receivable_payments;
create policy "member can view receivable_payments" on receivable_payments for select using (
  exists (select 1 from receivables_payables rp where rp.id = receivable_payable_id and is_company_member(rp.company_id)));
create policy "editor can insert receivable_payments" on receivable_payments for insert with check (
  exists (select 1 from receivables_payables rp where rp.id = receivable_payable_id and is_company_editor(rp.company_id)));
create policy "editor can update receivable_payments" on receivable_payments for update using (
  exists (select 1 from receivables_payables rp where rp.id = receivable_payable_id and is_company_editor(rp.company_id))) with check (
  exists (select 1 from receivables_payables rp where rp.id = receivable_payable_id and is_company_editor(rp.company_id)));
create policy "editor can delete receivable_payments" on receivable_payments for delete using (
  exists (select 1 from receivables_payables rp where rp.id = receivable_payable_id and is_company_editor(rp.company_id)));

create or replace function create_transaction(
  p_company_id uuid, p_date timestamptz, p_type transaction_type, p_note text,
  p_contact_id uuid, p_lines jsonb
) returns uuid as $$
declare
  v_txn_id uuid;
  v_line jsonb;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (p_company_id, p_date, p_type, p_note, p_contact_id, auth.uid())
    returning id into v_txn_id;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into journal_entries (transaction_id, account_id, debit, credit)
    values (v_txn_id, (v_line->>'account_id')::uuid, coalesce((v_line->>'debit')::numeric, 0), coalesce((v_line->>'credit')::numeric, 0));
  end loop;
  return v_txn_id;
end;
$$ language plpgsql security invoker;

create or replace function set_account_opening_balance(
  p_company_id uuid, p_account_id uuid, p_amount numeric, p_date date, p_note text default 'Saldo Awal'
) returns uuid as $$
declare
  v_txn_id uuid; v_ob_account uuid; v_normal normal_balance;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if p_amount is null or p_amount = 0 then raise exception 'Nominal saldo awal harus lebih dari 0'; end if;
  select normal_balance into v_normal from accounts where id = p_account_id and company_id = p_company_id;
  if v_normal is null then raise exception 'Akun tidak ditemukan'; end if;
  v_ob_account := get_or_create_opening_balance_account(p_company_id);
  insert into transactions (company_id, date, type, note, created_by)
    values (p_company_id, p_date, 'saldo_awal', p_note, auth.uid()) returning id into v_txn_id;
  if v_normal = 'debit' then
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, p_amount, 0), (v_txn_id, v_ob_account, 0, p_amount);
  else
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, 0, p_amount), (v_txn_id, v_ob_account, p_amount, 0);
  end if;
  return v_txn_id;
end;
$$ language plpgsql security invoker set search_path = public;

create or replace function set_opening_ar_ap(
  p_company_id uuid, p_contact_id uuid, p_type receivable_payable_type,
  p_account_id uuid, p_amount numeric, p_date date, p_due_date date default null,
  p_note text default null, p_invoice_no text default null
) returns uuid as $$
declare
  v_txn_id uuid; v_ob_account uuid; v_rp_id uuid;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Cuma Owner atau Editor yang bisa melakukan ini (Viewer cuma bisa lihat data)';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  v_ob_account := get_or_create_opening_balance_account(p_company_id);
  insert into transactions (company_id, date, type, note, contact_id, created_by)
    values (p_company_id, p_date, 'saldo_awal', coalesce(p_note, 'Saldo Awal ' || p_type), p_contact_id, auth.uid())
    returning id into v_txn_id;
  if p_type = 'piutang' then
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, p_amount, 0), (v_txn_id, v_ob_account, 0, p_amount);
  else
    insert into journal_entries (transaction_id, account_id, debit, credit) values
      (v_txn_id, p_account_id, 0, p_amount), (v_txn_id, v_ob_account, p_amount, 0);
  end if;
  insert into receivables_payables (company_id, transaction_id, contact_id, type, invoice_no, transaction_date, due_date, amount)
    values (p_company_id, v_txn_id, p_contact_id, p_type, p_invoice_no, p_date, p_due_date, p_amount)
    returning id into v_rp_id;
  return v_rp_id;
end;
$$ language plpgsql security invoker set search_path = public;
```

### Update kode frontend
Sama seperti biasa — backup `.env`, extract zip baru, pasang `.env`, `npm install`, `npm run dev`.

**Cara test**: undang 1 email lain (atau bikin akun baru) lewat Kelola Akses dengan peran
**Viewer**, login pakai akun itu, coba buka Tambah Transaksi / Master Data — harusnya semua form
diganti notice "cuma bisa lihat", dan kalau dipaksa lewat cara lain tetap ditolak database.
