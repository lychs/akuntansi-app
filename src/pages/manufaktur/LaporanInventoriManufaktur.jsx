import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'

const TYPE_ORDER = ['raw_material', 'supporting_material', 'wip', 'finished_goods', 'scrap']

export default function LaporanInventoriManufaktur() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [rows, setRows] = useState([])

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data } = await supabase.rpc('get_manufacturing_inventory_summary', { p_company_id: companyId })
    setRows(data || [])
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const grandTotal = rows.reduce((s, r) => s + Number(r.total_value), 0)

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanInventoriManufaktur.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanInventoriManufaktur.pageHint')}</p>

      {TYPE_ORDER.map((type) => {
        const items = rows.filter((r) => r.item_type === type)
        if (!items.length) return null
        const subtotal = items.reduce((s, r) => s + Number(r.total_value), 0)
        return (
          <div key={type} style={{ marginBottom: 24 }}>
            <h4>{t(`produk.itemType_${type}`)}</h4>
            <table className="tbl">
              <thead><tr><th>{t('bom.component')}</th><th className="num">{t('laporanKonsumsiBahan.totalQty')}</th><th className="num">{t('productionOrder.costPerUnit')}</th><th className="num">{t('laporanKonsumsiBahan.totalCost')}</th></tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.product_id}><td>{r.product_name} ({r.product_code})</td><td className="num">{fmt(r.qty_on_hand)} {r.unit}</td><td className="num">{fmt(r.avg_unit_cost)}</td><td className="num">{fmt(r.total_value)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="subtotal-row"><td colSpan={3}>{t('laporanProduksi.grandTotal')}</td><td className="num">{fmt(subtotal)}</td></tr></tfoot>
            </table>
          </div>
        )
      })}
      {!rows.length && <p className="hint">{t('laporanKonsumsiBahan.noData')}</p>}
      {rows.length > 0 && (
        <div className="settings-card" style={{ padding: 16, marginTop: 8 }}>
          <div className="hint">{t('laporanInventoriManufaktur.grandTotalAll')}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(grandTotal)}</div>
        </div>
      )}
    </div>
  )
}
