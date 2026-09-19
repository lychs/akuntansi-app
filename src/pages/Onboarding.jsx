import { useTranslation } from 'react-i18next'
import { useCompany } from '../lib/CompanyContext.jsx'
import CompanyForm from '../components/CompanyForm.jsx'

export default function Onboarding() {
  const { t } = useTranslation()
  const { refresh, setActiveCompanyId } = useCompany()

  async function handleSuccess(companyId) {
    await refresh()
    setActiveCompanyId(companyId)
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <CompanyForm onSuccess={handleSuccess} submitLabel={t('companyForm.submitCreate')} />
      </div>
    </div>
  )
}
