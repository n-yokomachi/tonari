export type AIService = string

export type Language = (typeof LANGUAGES)[number]

export const LANGUAGES = ['ja', 'en'] as const

export const isLanguageSupported = (language: string): language is Language =>
  LANGUAGES.includes(language as Language)

export const VRM_MODELS = [
  '/vrm/Tonari_normal.vrm',
  '/vrm/Tonari_glasses.vrm',
] as const
export const DEFAULT_VRM = VRM_MODELS[0]
