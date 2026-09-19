import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'

// Hook gabungan buat 4 filter dimension (Cabang/Departemen/Proyek/Gudang)
// sekaligus — dipakai di semua laporan. Tiap laporan cuma perlu satu hook ini
// buat dapetin ID + daftar pilihan keempatnya, terus tinggal disebar ke RPC.
export function useDimensionFilters(companyId) {
  const [costCenterId, setCostCenterId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [costCenters, setCostCenters] = useState([])
  const [departments, setDepartments] = useState([])
  const [projects, setProjects] = useState([])
  const [warehouses, setWarehouses] = useState([])

  useEffect(() => {
    if (!companyId) return
    supabase.from('cost_centers').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setCostCenters(data || []))
    supabase.from('departments').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setDepartments(data || []))
    supabase.from('projects').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setProjects(data || []))
    supabase.from('warehouses').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setWarehouses(data || []))
  }, [companyId])

  // Dipakai sebagai dependency array biar useEffect reload data laporan
  const depsKey = `${costCenterId}|${departmentId}|${projectId}|${warehouseId}`

  // Object siap-pakai buat disebar (...) langsung ke parameter RPC
  const rpcParams = {
    p_cost_center_id: costCenterId || null,
    p_department_id: departmentId || null,
    p_project_id: projectId || null,
    p_warehouse_id: warehouseId || null,
  }

  return {
    costCenterId, setCostCenterId, departmentId, setDepartmentId, projectId, setProjectId, warehouseId, setWarehouseId,
    costCenters, departments, projects, warehouses, depsKey, rpcParams,
  }
}

// Dropdown gabungan — nampilin cuma yang datanya ada (biar gak numpuk dropdown
// kosong buat perusahaan yang belum pakai dimension tertentu).
export default function DimensionFilters(f) {
  const { t } = useTranslation()
  if (!f.costCenters.length && !f.departments.length && !f.projects.length && !f.warehouses.length) return null
  return (
    <>
      {f.costCenters.length > 0 && (
        <select value={f.costCenterId} onChange={(e) => f.setCostCenterId(e.target.value)}>
          <option value="">{t('costCenter.allBranches')}</option>
          {f.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </select>
      )}
      {f.departments.length > 0 && (
        <select value={f.departmentId} onChange={(e) => f.setDepartmentId(e.target.value)}>
          <option value="">{t('department.allLabel')}</option>
          {f.departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
        </select>
      )}
      {f.projects.length > 0 && (
        <select value={f.projectId} onChange={(e) => f.setProjectId(e.target.value)}>
          <option value="">{t('project.allLabel')}</option>
          {f.projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
        </select>
      )}
      {f.warehouses.length > 0 && (
        <select value={f.warehouseId} onChange={(e) => f.setWarehouseId(e.target.value)}>
          <option value="">{t('warehouse.allLabel')}</option>
          {f.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
        </select>
      )}
    </>
  )
}
