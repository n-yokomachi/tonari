export type AIService = string

export type Language = (typeof LANGUAGES)[number]

export const LANGUAGES = ['ja', 'en'] as const

export const isLanguageSupported = (language: string): language is Language =>
  LANGUAGES.includes(language as Language)

export const VRM_MODELS = [
  { path: '/vrm/tonari_a.vrm', label: 'A' },
  { path: '/vrm/tonari_b.vrm', label: 'B' },
  { path: '/vrm/tonari_c.vrm', label: 'C' },
  { path: '/vrm/tonari_d.vrm', label: 'D' },
] as const
export const DEFAULT_VRM = VRM_MODELS[0].path
