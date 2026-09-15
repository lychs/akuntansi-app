-- ============================================================================
-- PERBAIKAN v2: reset_company_data — hapus fiscal_closings berdasarkan
-- transaction_id yang beneran mau dihapus (bukan cuma company_id), biar
-- dijamin gak ada lagi baris fiscal_closings yang nyantol pas transactions
-- coba dihapus (itu penyebab error "violates foreign key constraint
-- fiscal_closings_transaction_id_fkey").
-- ============================================================================

create or replace function reset_company_data(p_company_id uuid)
returns void as $$
begin
  if not is_company_admin(p_company_id) then
    raise exception 'Cuma Owner yang bisa menghapus semua data perusahaan';
  end if;

  -- 1. Pembayaran piutang/hutang
  delete from receivable_payments
    where receivable_payable_id in (select id from receivables_payables where company_id = p_company_id);

  -- 2. Baris hutang piutang
  delete from receivables_payables where company_id = p_company_id;

  -- 3. Riwayat tutup buku — target LANGSUNG via transaction_id yang bakal
  --    dihapus, biar gak ada yang nyantol apapun isi company_id-nya.
  delete from fiscal_closings
    where company_id = p_company_id
       or transaction_id in (select id from transactions where company_id = p_company_id);

  -- 4. Data modul Dagang
  delete from product_movements where company_id = p_company_id;
  delete from product_stock_layers where company_id = p_company_id;
  delete from product_branch_stock where company_id = p_company_id;
  delete from products where company_id = p_company_id;

  -- 5. Jurnal
  delete from journal_entries where transaction_id in (select id from transactions where company_id = p_company_id);

  -- 6. Transaksi
  delete from transactions where company_id = p_company_id;

  -- 7. Aset
  delete from assets where company_id = p_company_id;

  -- 8. Akun / COA
  delete from accounts where company_id = p_company_id;

  -- 9. Kontak
  delete from contacts where company_id = p_company_id;

  -- 10. Cabang & dimension lain
  delete from cost_centers where company_id = p_company_id;
  delete from departments where company_id = p_company_id;
  delete from projects where company_id = p_company_id;
  delete from warehouses where company_id = p_company_id;

  -- 11. Bersihin referensi akun otomatis di companies
  update companies set
    inventory_account_id = null, cogs_account_id = null, sales_revenue_account_id = null,
    opname_variance_account_id = null, sales_return_account_id = null
  where id = p_company_id;
end;
$$ language plpgsql security invoker;
