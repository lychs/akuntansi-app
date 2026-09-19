-- ============================================================================
-- PERBAIKAN: "Hapus Semua Data" gagal dengan error foreign key constraint
-- karena tabel companies punya kolom yang nunjuk ke accounts (kemungkinan
-- besar akun default buat Retur Penjualan/Pembelian atau sejenisnya), dan
-- constraint-nya masih default (menolak penghapusan kalau masih direferensi)
-- bukannya otomatis dikosongkan.
--
-- Query ini otomatis nemuin SEMUA foreign key dari companies -> accounts
-- (berapa pun jumlahnya, apapun nama kolomnya) dan ganti perilakunya jadi
-- ON DELETE SET NULL — jadi begitu akun dihapus, kolom referensinya di
-- companies otomatis dikosongkan, bukan malah nge-block penghapusan.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select con.conname, att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class frel on frel.oid = con.confrelid
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.contype = 'f'
      and rel.relname = 'companies'
      and frel.relname = 'accounts'
  loop
    execute format('alter table companies drop constraint %I', r.conname);
    execute format(
      'alter table companies add constraint %I foreign key (%I) references accounts(id) on delete set null',
      r.conname, r.column_name
    );
    raise notice 'Fixed constraint % on column %', r.conname, r.column_name;
  end loop;
end $$;
