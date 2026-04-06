import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for easy access to translations
 * Usage: const { t, i18n } = useTranslation();
 */
export function useTranslation() {
    return useI18nTranslation();
}

/**
 * Hook to get current language
 */
export function useLanguage() {
    const { i18n } = useI18nTranslation();
    return i18n.language;
}

/**
 * Hook to change language
 */
export function useChangeLanguage() {
    const { i18n } = useI18nTranslation();

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        localStorage.setItem('appLanguage', lang);
    };

    return changeLanguage;
}
