-- ============================================================================
-- PERBAIKAN: v_receivables_payables dibikin pakai "rp.*" waktu tabel
-- receivables_payables MASIH BELUM punya kolom cost_center_id/department_id/
-- project_id/warehouse_id. Di PostgreSQL, "SELECT tbl.*" di sebuah VIEW itu
-- kolomnya "dibekukan" persis di saat CREATE VIEW dijalankan — nambah kolom
-- baru ke tabel aslinya belakangan TIDAK bikin view lama otomatis ikutan
-- punya kolom itu. Makanya muncul error "column ... cost_center_id does
-- not exist" pas filter Cabang dipakai di Laporan Hutang Piutang.
--
-- Perbaikannya: DROP VIEW dulu, baru CREATE ulang — biar kolom barunya ikut
-- masuk ke daftar kolom view yang baru.
-- ============================================================================

drop view if exists v_receivables_payables;

create view v_receivables_payables as
select
  rp.*,
  ct.name as contact_name,
  (rp.amount - rp.paid_amount) as sisa,
  case
    when rp.paid_amount >= rp.amount then 'Lunas'
    when rp.due_date is not null and rp.due_date < current_date and rp.paid_amount < rp.amount then 'Overdue'
    else 'Pending'
  end as status
from receivables_payables rp
join contacts ct on ct.id = rp.contact_id;
