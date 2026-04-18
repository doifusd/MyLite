import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import zhTranslations from './locales/zh.json';

const resources = {
    en: {
        translation: enTranslations,
    },
    zh: {
        translation: zhTranslations,
    },
};

// Get saved language from localStorage or detect system language
const getSavedLanguage = () => {
    const saved = localStorage.getItem('appLanguage');
    if (saved) return saved;

    // Detect system language
    const systemLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
    return systemLang;
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getSavedLanguage(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already escapes values
        },
    });

export default i18n;
