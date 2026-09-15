import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Briefcase, Package, Factory, Users2, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import CompanyForm from '../components/CompanyForm.jsx'

const BUSINESS_TYPE_ICON = { jasa: Briefcase, dagang: Package, manufaktur: Factory }

export default function ProfilPerusahaan() {
  const { t, i18n } = useTranslation()
  const { activeCompanyId, refresh } = useCompany()
  const [companyData, setCompanyData] = useState(null)
  const [memberCount, setMemberCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (activeCompanyId) load()
  }, [activeCompanyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('companies').select('*').eq('id', activeCompanyId).maybeSingle()
    setCompanyData(data)
    const { count } = await supabase.from('company_users').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId)
    setMemberCount(count)
    setLoading(false)
  }

  async function handleSuccess() {
    setSaved(true)
    await refresh()
    load()
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="page-loading-center">
        <div className="page-loading-spinner" />
        <p>{t('common.loading')}</p>
      </div>
    )
  }
  if (!companyData) return <div className="p-6">{t('profilPerusahaan.notFound')}</div>

  const BizIcon = BUSINESS_TYPE_ICON[companyData.business_type] || Briefcase
  const bizLabel = t(`companyForm.businessType${companyData.business_type === 'jasa' ? 'Jasa' : companyData.business_type === 'dagang' ? 'Dagang' : 'Manufaktur'}`)
  const createdDate = companyData.created_at ? new Date(companyData.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) : '-'

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('profilPerusahaan.title')}</h1></div>

      <div className="profile-banner">
        <div className="profile-banner-logo">
          {companyData.logo_url ? <img src={companyData.logo_url} alt="" /> : <Building2 size={30} />}
        </div>
        <div className="profile-banner-info">
          <div className="profile-banner-name">{companyData.name}</div>
          {companyData.business_name && <div className="profile-banner-sub">{companyData.business_name}</div>}
          <div className="profile-banner-stats">
            <span className="profile-stat-pill"><BizIcon size={13} /> {bizLabel}</span>
            <span className="profile-stat-pill"><Users2 size={13} /> {memberCount ?? '-'} {t('profilPerusahaan.members')}</span>
            <span className="profile-stat-pill"><Calendar size={13} /> {t('profilPerusahaan.since')} {createdDate}</span>
          </div>
        </div>
      </div>

      <div className="section" style={{ maxWidth: '100%' }}>
        {saved && <p style={{ color: 'var(--positive)', fontSize: 13, marginBottom: 14 }}>{t('profilPerusahaan.updateSuccess')}</p>}
        <CompanyForm mode="edit" initialData={companyData} onSuccess={handleSuccess} submitLabel={t('companyForm.submitEdit')} />
        <p className="hint" style={{ marginTop: 16 }}>
          {t('profilPerusahaan.adminOnlyHint')}
        </p>
      </div>
    </div>
  )
}
