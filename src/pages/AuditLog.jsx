import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'

const ACTION_LABEL = { insert: 'Ditambahkan', update: 'Diubah', delete: 'Dihapus' }
const ACTION_COLOR = { insert: 'var(--positive)', update: 'var(--warning, #d97706)', delete: 'var(--negative)' }

export default function AuditLog() {
  const { t } = useTranslation()
  const { activeCompanyId } = useCompany()
  const { session } = useAuth()
  const [logs, setLogs] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [tableFilter, setTableFilter] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => { if (activeCompanyId) checkAdminAndLoad() }, [activeCompanyId, tableFilter, page])

  async function checkAdminAndLoad() {
    setLoading(true)
    const { data: memberData } = await supabase
      .from('company_users')
      .select('role')
      .eq('company_id', activeCompanyId)
      .eq('user_id', session.user.id)
      .maybeSingle()
    const admin = memberData?.role === 'admin'
    setIsAdmin(admin)
    if (!admin) { setLoading(false); return }

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (tableFilter !== 'all') query = query.eq('table_name', tableFilter)

    const { data, error } = await query
    if (!error) setLogs(data || [])
    setLoading(false)
  }

  function diffFields(oldData, newData) {
    if (!oldData || !newData) return []
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
    const changed = []
    keys.forEach((k) => {
      if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
        changed.push({ field: k, before: oldData[k], after: newData[k] })
      }
    })
    return changed
  }

  const tableOptions = [...new Set(logs.map((l) => l.table_name))]

  if (!loading && !isAdmin) {
    return (
      <div className="p-6">
        <div className="page-header"><h1>Riwayat Aktivitas</h1></div>
        <p className="hint">Cuma Admin yang bisa melihat riwayat aktivitas perusahaan ini.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1><History size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Riwayat Aktivitas</h1>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>
        Catatan siapa mengubah, menambah, atau menghapus data, dan kapan.
      </p>

      <div className="field" style={{ maxWidth: 260, marginBottom: 16 }}>
        <label>Filter tabel</label>
        <select value={tableFilter} onChange={(e) => { setTableFilter(e.target.value); setPage(0) }}>
          <option value="all">Semua</option>
          {tableOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="hint">Memuat...</p>
      ) : logs.length === 0 ? (
        <p className="hint">Belum ada aktivitas tercatat.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Aksi</th>
              <th>Tabel</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const changes = log.action === 'update' ? diffFields(log.old_data, log.new_data) : []
              const isOpen = expandedId === log.id
              return (
                <>
                  <tr
                    key={log.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(isOpen ? null : log.id)}
                  >
                    <td>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td>{log.user_email || '-'}</td>
                    <td>
                      <span style={{ color: ACTION_COLOR[log.action], fontWeight: 600 }}>
                        {ACTION_LABEL[log.action] || log.action}
                      </span>
                    </td>
                    <td>{log.table_name}</td>
                  </tr>
                  {isOpen && (
                    <tr key={log.id + '-detail'}>
                      <td></td>
                      <td colSpan={3}>
                        {log.action === 'update' ? (
                          changes.length === 0 ? (
                            <span className="hint">Tidak ada field yang berubah nilainya.</span>
                          ) : (
                            <table className="tbl" style={{ margin: '8px 0' }}>
                              <thead><tr><th>Field</th><th>Sebelum</th><th>Sesudah</th></tr></thead>
                              <tbody>
                                {changes.map((c) => (
                                  <tr key={c.field}>
                                    <td>{c.field}</td>
                                    <td style={{ color: 'var(--negative)' }}>{String(c.before ?? '-')}</td>
                                    <td style={{ color: 'var(--positive)' }}>{String(c.after ?? '-')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        ) : (
                          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', padding: 10, borderRadius: 6 }}>
                            {JSON.stringify(log.action === 'delete' ? log.old_data : log.new_data, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
        <button className="btn-secondary" disabled={logs.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
      </div>
    </div>
  )
}
