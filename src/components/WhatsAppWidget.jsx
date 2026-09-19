import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, X, Send } from 'lucide-react'

const WHATSAPP_URL = 'https://wa.me/6285692050908'

export default function WhatsAppWidget() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="wa-widget">
      {open && (
        <div className="wa-widget-card">
          <div className="wa-widget-card-head">
            <div className="wa-widget-avatar"><MessageCircle size={18} /></div>
            <div>
              <div className="wa-widget-title">{t('waWidget.title')}</div>
              <div className="wa-widget-sub">{t('waWidget.subtitle')}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
          </div>
          <p className="wa-widget-msg">{t('waWidget.message')}</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="wa-widget-cta">
            <Send size={14} /> {t('waWidget.cta')}
          </a>
        </div>
      )}
      <button type="button" className="wa-widget-fab" onClick={() => setOpen(!open)} aria-label="WhatsApp">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
