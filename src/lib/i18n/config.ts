export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

export function isSupportedLanguage(value: string | null | undefined): value is LanguageCode {
  return !!value && SUPPORTED_LANGUAGES.some((l) => l.code === value)
}