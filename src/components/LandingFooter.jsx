import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function LandingFooter() {
  const { t } = useTranslation()
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-top">
          <div>
            <Link to="/" className="lp-nav-brand">
              <img src="/logo-icon.png" alt="My Worksheet" className="lp-nav-mark" />
              <span className="lp-nav-word">My Worksheet</span>
            </Link>
            <p className="lp-footer-brand-desc">{t('landing.footer.desc')}</p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">{t('landing.footer.productCol')}</div>
              <Link to="/fitur">{t('landing.nav.fitur')}</Link>
              <Link to="/harga">{t('landing.nav.harga')}</Link>
              <Link to="/login">{t('landing.footer.dashboardLink')}</Link>
              <Link to="/harga">{t('landing.footer.laporanLink')}</Link>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">{t('landing.footer.companyCol')}</div>
              <Link to="/tentang">{t('landing.footer.tentangKami')}</Link>
              <a href="https://wa.me/6285692050908" target="_blank" rel="noopener noreferrer">{t('landing.footer.kontak')}</a>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">{t('landing.footer.helpCol')}</div>
              <Link to="/harga">{t('landing.footer.helpCenter')}</Link>
              <Link to="/harga">{t('landing.footer.faq')}</Link>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">{t('landing.footer.legalCol')}</div>
              <Link to="/kebijakan-privasi">{t('landing.footer.privacy')}</Link>
              <Link to="/syarat-ketentuan">{t('landing.footer.terms')}</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} My Worksheet. {t('landing.footer.copyright')}</span>
        </div>
      </div>
    </footer>
  )
}
