import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Factory, Package, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function DashboardManufaktur() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data: orders } = await supabase
      .from('production_orders')
      .select('id, order_number, date, status, planned_qty, accumulated_material_cost, accumulated_labor_cost, accumulated_overhead_cost, products(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    const all = orders || []
    const inProgress = all.filter((o) => ['released', 'in_progress'].includes(o.status))
    const completedThisMonth = all.filter((o) => o.status === 'completed' && new Date(o.date).getMonth() === new Date().getMonth() && new Date(o.date).getFullYear() === new Date().getFullYear())
    const totalWipValue = inProgress.reduce((s, o) => s + Number(o.accumulated_material_cost) + Number(o.accumulated_labor_cost) + Number(o.accumulated_overhead_cost), 0)

    const { data: results } = await supabase.from('production_results').select('good_qty, reject_qty, scrap_qty').eq('company_id', companyId)
    const totalGood = (results || []).reduce((s, r) => s + Number(r.good_qty), 0)
    const totalReject = (results || []).reduce((s, r) => s + Number(r.reject_qty), 0) + (results || []).reduce((s, r) => s + Number(r.scrap_qty), 0)
    const rejectRate = totalGood + totalReject > 0 ? (totalReject / (totalGood + totalReject)) * 100 : 0

    setStats({ activeCount: inProgress.length, completedCount: completedThisMonth.length, wipValue: totalWipValue, rejectRate })
    setRecentOrders(all.slice(0, 8))
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)

  if (!stats) return <div className="p-6"><p className="hint">{t('common.loading')}</p></div>

  return (
    <div className="p-6">
      <div className="page-header"><h1><Factory size={20} style={{ verticalAlign: -3, marginRight: 8 }} />{t('dashboardManufaktur.title')}</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="settings-card" style={{ padding: 16 }}>
          <div className="hint" style={{ marginBottom: 6 }}>{t('dashboardManufaktur.activeOrders')}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.activeCount}</div>
        </div>
        <div className="settings-card" style={{ padding: 16 }}>
          <div className="hint" style={{ marginBottom: 6 }}>{t('dashboardManufaktur.completedThisMonth')}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.completedCount}</div>
        </div>
        <div className="settings-card" style={{ padding: 16 }}>
          <div className="hint" style={{ marginBottom: 6 }}>{t('dashboardManufaktur.wipValue')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)' }}>{fmt(stats.wipValue)}</div>
        </div>
        <div className="settings-card" style={{ padding: 16 }}>
          <div className="hint" style={{ marginBottom: 6 }}>{t('dashboardManufaktur.rejectRate')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.rejectRate > 5 ? 'var(--negative)' : 'var(--positive)' }}>{stats.rejectRate.toFixed(1)}%</div>
        </div>
      </div>

      <h3 style={{ marginBottom: 12 }}>{t('dashboardManufaktur.recentOrders')}</h3>
      <table className="tbl">
        <thead><tr><th>{t('productionOrder.colNumber')}</th><th>{t('productionOrder.colProduct')}</th><th>{t('laporanTransaksi.colDate')}</th><th>{t('hutangPiutang.colStatus')}</th></tr></thead>
        <tbody>
          {recentOrders.map((o) => (
            <tr key={o.id}><td><Link to={`/manufaktur/production-order/${o.id}`}>{o.order_number}</Link></td><td>{o.products?.name}</td><td>{o.date}</td><td>{t(`productionOrder.status_${o.status}`)}</td></tr>
          ))}
          {!recentOrders.length && <tr><td colSpan={4} className="empty">{t('productionOrder.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
