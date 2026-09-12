import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import { daysUntil, fmt } from '../lib/reportHelpers.js'

export default function NotificationBell() {
  const { t } = useTranslation()
  const { activeCompanyId } = useCompany()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (activeCompanyId) load()
  }, [activeCompanyId])

  async function load() {
    const in7days = new Date()
    in7days.setDate(in7days.getDate() + 7)
    const { data, error } = await supabase
      .from('v_receivables_payables')
      .select('*')
      .eq('company_id', activeCompanyId)
      .eq('type', 'piutang')
      .neq('status', 'Lunas')
      .not('due_date', 'is', null)
      .lte('due_date', in7days.toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
    if (error) { console.error(error); return }
    setItems(data || [])
  }

  return (
    <div className="notif-wrap">
      <button className="notif-btn" onClick={() => setOpen(!open)}>
        <Bell size={19} />
        {items.length > 0 && <span className="notif-badge">{items.length}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-title">{t('notifBell.title')}</div>
          {!items.length && <div className="notif-empty">{t('notifBell.empty')}</div>}
          {items.map((it) => {
            const d = daysUntil(it.due_date)
            return (
              <button
                key={it.id}
                className="notif-item"
                onClick={() => { setOpen(false); navigate('/laporan/hutang-piutang') }}
              >
                <div className="notif-item-title">{it.contact_name}</div>
                <div className="notif-item-sub">
                  {fmt(it.sisa)} — {d < 0 ? t('notifBell.overdue', { days: -d }) : d === 0 ? t('notifBell.dueToday') : t('notifBell.dueInDays', { days: d })}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
