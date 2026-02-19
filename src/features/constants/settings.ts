export type VercelCloudAIService =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'xai'
  | 'groq'
  | 'cohere'
  | 'mistralai'
  | 'perplexity'
  | 'fireworks'
  | 'deepseek'
  | 'openrouter'
  | 'lmstudio'
  | 'ollama'
  | 'custom-api'

export type VercelLocalAIService = 'lmstudio' | 'ollama' | 'custom-api'

export type VercelAIService = VercelCloudAIService | VercelLocalAIService

// VercelCloudAIServiceかどうかを判定する型ガード関数
export const isVercelCloudAIService = (
  service: string
): service is VercelCloudAIService => {
  const cloudServices: VercelCloudAIService[] = [
    'openai',
    'anthropic',
    'google',
    'azure',
    'xai',
    'groq',
    'cohere',
    'mistralai',
    'perplexity',
    'fireworks',
    'deepseek',
    'openrouter',
  ]
  return cloudServices.includes(service as VercelCloudAIService)
}

// VercelLocalAIServiceかどうかを判定する型ガード関数
export const isVercelLocalAIService = (
  service: string
): service is VercelLocalAIService => {
  const localServices: VercelLocalAIService[] = [
    'lmstudio',
    'ollama',
    'custom-api',
  ]
  return localServices.includes(service as VercelLocalAIService)
}

export type AIService = VercelAIService

export interface AIServiceConfig {
  openai: { key: string; model: string }
  anthropic: { key: string; model: string }
  google: { key: string; model: string }
  lmstudio: { url: string; model: string }
  ollama: { url: string; model: string }
  azure: { key: string; model: string }
  xai: { key: string; model: string }
  groq: { key: string; model: string }
  cohere: { key: string; model: string }
  mistralai: { key: string; model: string }
  perplexity: { key: string; model: string }
  fireworks: { key: string; model: string }
  openrouter: { key: string; model: string }
  deepseek: { key: string; model: string }
}

export type Language = (typeof LANGUAGES)[number]

export const LANGUAGES = ['ja', 'en'] as const

export const isLanguageSupported = (language: string): language is Language =>
  LANGUAGES.includes(language as Language)

export const VRM_MODELS = ['/vrm/tonari_f.vrm', '/vrm/tonari_m.vrm'] as const
export const DEFAULT_VRM = VRM_MODELS[0]
