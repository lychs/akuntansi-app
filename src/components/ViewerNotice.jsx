import { useTranslation } from 'react-i18next'

export default function ViewerNotice({ text }) {
  const { t } = useTranslation()
  return <div className="viewer-notice">👁️ {text || t('viewerNotice.default')}</div>
}
