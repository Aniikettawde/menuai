'use client'

import { useAppStore } from '@/store/app-store'
import { translations, type TranslationKey } from './translations'
import { DEFAULT_LANGUAGE } from './config'

/**
 * Static UI-string translation hook.
 * For dynamic menu content (dish/category names & descriptions) use
 * `useTranslatedMenu` instead — those come from the DB and are
 * machine-translated + cached, not part of this dictionary.
 */
export function useTranslation() {
  const language = useAppStore((s) => s.language ?? DEFAULT_LANGUAGE)

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    const dict = translations[language] ?? translations[DEFAULT_LANGUAGE]
    let str = dict[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  // Convenience for the common "N result(s)" / "N item(s)" pluralization
  function plural(n: number, singularKey: TranslationKey, pluralKey: TranslationKey): string {
    return `${n} ${n === 1 ? t(singularKey) : t(pluralKey)}`
  }

  return { t, plural, language }
}