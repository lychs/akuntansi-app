import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageIcon, Briefcase, Package, Factory, Fingerprint } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext.jsx'

const MAX_LOGO_KB = 512

// mode="create" (default): bikin company baru (Onboarding / Tambah Perusahaan) via RPC create_company.
// mode="edit": update company yang sudah ada (Profil Perusahaan) via UPDATE langsung ke tabel (RLS: admin only).
export default function CompanyForm({ onSuccess, submitLabel, mode = 'create', initialData = null }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [name, setName] = useState(initialData?.name || '')
  const [businessName, setBusinessName] = useState(initialData?.business_name || '')
  const [businessField, setBusinessField] = useState(initialData?.business_field || '')
  const [businessType, setBusinessType] = useState(initialData?.business_type || 'jasa')
  const [inventoryMethod, setInventoryMethod] = useState(initialData?.inventory_method || '')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(initialData?.logo_url || null)
  const [saving, setSaving] = useState(false)
  const submitLockRef = useRef(false)
  const [error, setError] = useState(null)

  const BUSINESS_TYPES = [
    { value: 'jasa', label: t('companyForm.businessTypeJasa'), desc: t('companyForm.businessTypeJasaDesc'), icon: Briefcase, disabled: false },
    { value: 'dagang', label: t('companyForm.businessTypeDagang'), desc: t('companyForm.businessTypeDagangDesc'), icon: Package, disabled: false },
    { value: 'manufaktur', label: t('companyForm.businessTypeManufaktur'), desc: t('companyForm.businessTypeManufakturDesc'), icon: Factory, disabled: true },
  ]

  // Metode persediaan sesuai PSAK 14 / IAS 2 — cuma FIFO, Rata-rata (Weighted Average),
  // dan Identifikasi Khusus yang diizinkan (LIFO TIDAK diperbolehkan di standar Indonesia).
  const INVENTORY_METHODS = [
    { value: 'fifo', label: t('companyForm.inventoryMethodFifo'), desc: t('companyForm.inventoryMethodFifoDesc'), icon: Package },
    { value: 'average', label: t('companyForm.inventoryMethodAverage'), desc: t('companyForm.inventoryMethodAverageDesc'), icon: Package },
    { value: 'specific', label: t('companyForm.inventoryMethodSpecific'), desc: t('companyForm.inventoryMethodSpecificDesc'), icon: Fingerprint },
  ]

  // Nilai yang DISIMPAN ke database tetap teks kanonik Bahasa Indonesia (biar konsisten
  // dengan data lama & gak berubah-ubah tergantung bahasa UI saat disimpan) — cuma LABEL
  // yang ditampilkan ke user yang diterjemahkan.
  const BIDANG_USAHA = [
    { value: 'Event Organizer', label: t('companyForm.fieldEventOrganizer') },
    { value: 'Food & Beverage', label: t('companyForm.fieldFnb') },
    { value: 'Konstruksi & Properti', label: t('companyForm.fieldKonstruksi') },
    { value: 'Teknologi', label: t('companyForm.fieldTeknologi') },
    { value: 'Kesehatan', label: t('companyForm.fieldKesehatan') },
    { value: 'Pendidikan', label: t('companyForm.fieldPendidikan') },
    { value: 'Fashion & Kecantikan', label: t('companyForm.fieldFashion') },
    { value: 'Otomotif', label: t('companyForm.fieldOtomotif') },
    { value: 'Lainnya', label: t('companyForm.fieldLainnya') },
  ]

  function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError(t('companyForm.errLogoType'))
      return
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      setError(t('companyForm.errLogoSize', { max: MAX_LOGO_KB }))
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function uploadLogoIfNeeded() {
    if (!logoFile) return initialData?.logo_url || null
    const path = `${session.user.id}/${Date.now()}-${logoFile.name}`
    const { error: uploadError } = await supabase.storage.from('company-logos').upload(path, logoFile)
    if (uploadError) throw new Error(t('companyForm.errUploadFailed', { msg: uploadError.message }))
    return supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Ref (bukan cuma state) biar submit ganda ke-block seketika — state React
    // baru "kelihatan" ke re-render berikutnya, jadi kalau tombol diklik 2x
    // dengan sangat cepat (atau ada auto-retry jaringan), state `saving` sendirian
    // gak cukup buat mencegah dua request `create_company` terkirim sekaligus.
    if (submitLockRef.current) return
    submitLockRef.current = true
    setError(null)
    setSaving(true)
    try {
      const logoUrl = await uploadLogoIfNeeded()

      if (mode === 'edit') {
        const { data, error } = await supabase.from('companies').update({
          name,
          business_name: businessName || null,
          business_field: businessField || null,
          logo_url: logoUrl,
        }).eq('id', initialData.id).select()
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error(t('companyForm.errNotAdmin'))
        }
        onSuccess(initialData.id)
      } else {
        if (businessType === 'dagang' && !inventoryMethod) {
          throw new Error(t('companyForm.errInventoryMethodRequired'))
        }
        const { data, error } = await supabase.rpc('create_company', {
          p_name: name,
          p_business_name: businessName || null,
          p_category: null,
          p_business_field: businessField || null,
          p_logo_url: logoUrl,
          p_business_type: businessType,
          p_inventory_method: businessType === 'dagang' ? inventoryMethod : null,
        })
        if (error) throw error
        onSuccess(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
      submitLockRef.current = false
    }
  }

  return (
    <form onSubmit={handleSubmit} className="company-form">
      {mode === 'create' && (
        <>
          <h1>{t('companyForm.createTitle')}</h1>
          <p className="hint" style={{ marginTop: -8, marginBottom: 18 }}>
            {t('companyForm.createSubtitle')}
          </p>
        </>
      )}

      {mode === 'edit' ? (
        <div className="company-form-row-2col">
          <div>
            <label>{t('companyForm.logo')}</label>
            <div className="logo-upload-row">
              <div className="logo-preview">
                {logoPreview ? <img src={logoPreview} alt="Logo" /> : <ImageIcon size={26} color="#b8b3a3" />}
              </div>
              <div>
                <label className="btn-secondary logo-upload-btn">
                  {t('companyForm.upload')}
                  <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} hidden />
                </label>
                <p className="logo-hint">{t('companyForm.logoHint', { max: MAX_LOGO_KB })}<br />{t('companyForm.logoFileType')}</p>
              </div>
            </div>
          </div>
          <div>
            <label>{t('companyForm.businessField')}</label>
            <select value={businessField} onChange={(e) => setBusinessField(e.target.value)} required>
              <option value="">{t('companyForm.selectBusinessField')}</option>
              {BIDANG_USAHA.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <>
          <label>{t('companyForm.logo')}</label>
          <div className="logo-upload-row">
            <div className="logo-preview">
              {logoPreview ? <img src={logoPreview} alt="Logo" /> : <ImageIcon size={26} color="#b8b3a3" />}
            </div>
            <div>
              <label className="btn-secondary logo-upload-btn">
                {t('companyForm.upload')}
                <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} hidden />
              </label>
              <p className="logo-hint">{t('companyForm.logoHint', { max: MAX_LOGO_KB })}<br />{t('companyForm.logoFileType')}</p>
            </div>
          </div>
        </>
      )}

      {mode === 'edit' ? (
        <div className="company-form-row-2col">
          <div>
            <label>{t('companyForm.companyName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('companyForm.companyNamePlaceholder')} required />
          </div>
          <div>
            <label>{t('companyForm.businessName')}</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('companyForm.businessNamePlaceholder')} />
          </div>
        </div>
      ) : (
        <>
          <label>{t('companyForm.companyName')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('companyForm.companyNamePlaceholder')} required />
        </>
      )}

      {mode === 'create' && (
        <>
          <label>{t('companyForm.businessTypeLabel')}</label>
          <div className="biztype-grid">
            {BUSINESS_TYPES.map((bt) => {
              const Icon = bt.icon
              return (
                <button
                  type="button"
                  key={bt.value}
                  className={`biztype-card ${businessType === bt.value ? 'active' : ''} ${bt.disabled ? 'disabled' : ''}`}
                  onClick={() => !bt.disabled && setBusinessType(bt.value)}
                  disabled={bt.disabled}
                >
                  {bt.disabled && <span className="biztype-badge">{t('companyForm.comingSoon')}</span>}
                  <Icon size={20} />
                  <strong>{bt.label}</strong>
                  <span>{bt.desc}</span>
                </button>
              )
            })}
          </div>

          {businessType === 'dagang' && (
            <>
              <label>{t('companyForm.inventoryMethodLabel')}</label>
              <div className="invmethod-grid">
                {INVENTORY_METHODS.map((im) => {
                  const Icon = im.icon
                  return (
                    <button
                      type="button"
                      key={im.value}
                      className={`invmethod-card ${inventoryMethod === im.value ? 'active' : ''}`}
                      onClick={() => setInventoryMethod(im.value)}
                    >
                      <Icon size={16} />
                      <strong>{im.label}</strong>
                      <span>{im.desc}</span>
                    </button>
                  )
                })}
              </div>
              <p className="hint" style={{ marginTop: 4 }}>{t('companyForm.inventoryMethodHint')}</p>
            </>
          )}

          <label>{t('companyForm.businessName')}</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('companyForm.businessNamePlaceholder')} />
        </>
      )}

      {mode === 'create' && (
        <>
          <label>{t('companyForm.businessField')}</label>
          <select value={businessField} onChange={(e) => setBusinessField(e.target.value)} required>
            <option value="">{t('companyForm.selectBusinessField')}</option>
            {BIDANG_USAHA.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', marginTop: 22 }}>
        {saving ? t('companyForm.saving') : (submitLabel || t('common.save'))}
      </button>
    </form>
  )
}
