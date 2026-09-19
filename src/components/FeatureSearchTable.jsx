import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

const CATEGORY_ORDER = ['transaksi', 'laporan', 'dagang', 'struktur', 'aset', 'pengaturan']

export default function FeatureSearchTable() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState('all')

  const items = t('featureTable.items', { returnObjects: true })
  const categories = t('featureTable.categories', { returnObjects: true })

  const allItems = useMemo(() => Object.entries(items).map(([id, v]) => ({ id, ...v })), [items])

  const filtered = allItems.filter((it) => {
    const matchesCat = activeCat === 'all' || it.cat === activeCat
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || it.name.toLowerCase().includes(q) || it.summary.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  return (
    <div>
      <div className="lp-feattable-controls">
        <div className="lp-feattable-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('featureTable.search.placeholder')}
          />
        </div>
        <div className="lp-feattable-cats">
          <button type="button" className={activeCat === 'all' ? 'active' : ''} onClick={() => setActiveCat('all')}>
            {categories.all}
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button key={c} type="button" className={activeCat === c ? 'active' : ''} onClick={() => setActiveCat(c)}>
              {categories[c]}
            </button>
          ))}
        </div>
      </div>

      <p className="lp-feattable-count">
        {t('featureTable.search.showingCount', { count: filtered.length, total: allItems.length })}
      </p>

      <div className="lp-feattable-grid">
        {filtered.map((it) => (
          <div key={it.id} className="lp-feattable-row">
            <span className="lp-feattable-cat-tag">{categories[it.cat]}</span>
            <h4>{it.name}</h4>
            <p>{it.summary}</p>
          </div>
        ))}
      </div>
      {!filtered.length && <p className="hint" style={{ textAlign: 'center', padding: '32px 0' }}>{t('featureTable.search.noResults')}</p>}
    </div>
  )
}
