import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCompany } from '../lib/CompanyContext.jsx'
import CompanyForm from '../components/CompanyForm.jsx'

export default function TambahPerusahaan() {
  const { t } = useTranslation()
  const { refresh, setActiveCompanyId } = useCompany()
  const navigate = useNavigate()

  async function handleSuccess(companyId) {
    await refresh()
    setActiveCompanyId(companyId)
    navigate('/')
  }

  return (
    <div className="p-6">
      <div className="section" style={{ maxWidth: 760 }}>
        <CompanyForm onSuccess={handleSuccess} submitLabel={t('companyForm.submitAdd')} />
      </div>
    </div>
  )
}
