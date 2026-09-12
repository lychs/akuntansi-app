import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import id from './locales/id.json'
import en from './locales/en.json'
import ru from './locales/ru.json'
import fr from './locales/fr.json'
import ms from './locales/ms.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ar from './locales/ar.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩', dir: 'ltr' },
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾', dir: 'ltr' },
  { code: 'zh', label: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ja', label: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
]

const STORAGE_KEY = 'appLanguage'

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) return saved
  } catch (e) {
    // localStorage unavailable — fall through to default
  }
  return 'id'
}

export function applyDocumentDirection(lang) {
  const info = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0]
  document.documentElement.lang = info.code
  document.documentElement.dir = info.dir
}

const initialLang = detectInitialLanguage()

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
    ru: { translation: ru },
    fr: { translation: fr },
    ms: { translation: ms },
    zh: { translation: zh },
    ja: { translation: ja },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
})

applyDocumentDirection(initialLang)

i18n.on('languageChanged', (lng) => {
  applyDocumentDirection(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch (e) {
    // ignore
  }
})

export default i18n
