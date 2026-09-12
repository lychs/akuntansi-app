import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'

export function useCostCenterFilter(companyId) {
  const [costCenterId, setCostCenterId] = useState('')
  const [costCenters, setCostCenters] = useState([])

  useEffect(() => {
    if (!companyId) return
    supabase
      .from('cost_centers')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => setCostCenters(data || []))
  }, [companyId])

  return { costCenterId, setCostCenterId, costCenters }
}

// Dropdown filter "Cabang" — dipakai di semua laporan. Kosong ('') = semua
// cabang digabung (laporan company-wide seperti biasa).
export default function CostCenterFilter({ costCenterId, setCostCenterId, costCenters }) {
  const { t } = useTranslation()
  if (!costCenters.length) return null
  return (
    <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
      <option value="">{t('costCenter.allBranches')}</option>
      {costCenters.map((c) => (
        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
      ))}
    </select>
  )
}
