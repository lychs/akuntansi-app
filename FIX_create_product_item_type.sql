-- ============================================================================
-- PERBAIKAN: create_product ditambah parameter p_item_type (opsional, default
-- 'finished_goods' biar kompatibel sama pemanggilan lama dari modul Dagang
-- yang belum tau soal ini). Perubahan ini AMAN lewat CREATE OR REPLACE biasa
-- karena cuma nambah 1 parameter BARU dengan default di paling belakang —
-- bukan ngubah/ngurangin parameter yang udah ada, jadi gak bikin overload
-- duplikat.
-- ============================================================================

create or replace function create_product(
  p_company_id uuid,
  p_code text,
  p_name text,
  p_unit text,
  p_sale_price numeric,
  p_item_type text default 'finished_goods'
) returns uuid as $$
declare
  v_product_id uuid;
begin
  if not is_company_editor(p_company_id) then
    raise exception 'Kamu gak punya akses buat tambah barang di perusahaan ini';
  end if;
  insert into products (company_id, code, name, unit, sale_price, item_type)
    values (p_company_id, trim(p_code), trim(p_name), coalesce(nullif(trim(p_unit),''), 'pcs'), p_sale_price, coalesce(p_item_type, 'finished_goods'))
    returning id into v_product_id;
  return v_product_id;
end;
$$ language plpgsql security invoker;
