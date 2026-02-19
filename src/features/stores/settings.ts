import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { SYSTEM_PROMPT } from '@/features/constants/systemPromptConstants'
import {
  AIService,
  DEFAULT_VRM,
  Language,
  VRM_MODELS,
} from '../constants/settings'
import { googleSearchGroundingModels } from '../constants/aiModels'
import { migrateOpenAIModelName } from '@/utils/modelMigration'
import { getAppConfig } from '@/lib/config'

export type googleSearchGroundingModelKey =
  (typeof googleSearchGroundingModels)[number]

interface APIKeys {
  openaiKey: string
  anthropicKey: string
  googleKey: string
  azureKey: string
  xaiKey: string
  groqKey: string
  cohereKey: string
  mistralaiKey: string
  perplexityKey: string
  fireworksKey: string
  deepseekKey: string
  openrouterKey: string
  lmstudioKey: string
  ollamaKey: string
  azureEndpoint: string
  customApiUrl: string
  customApiHeaders: string
  customApiBody: string
  customApiStream: boolean
  includeSystemMessagesInCustomApi: boolean
  customApiIncludeMimeType: boolean
}

interface ModelProvider {
  selectAIService: AIService
  selectAIModel: string
  localLlmUrl: string
}

interface Character {
  characterName: string
  showAssistantText: boolean
  showCharacterName: boolean
  selectedVrmPath: string
  fixedCharacterPosition: boolean
  characterPosition: {
    x: number
    y: number
    z: number
    scale: number
  }
  characterRotation: {
    x: number
    y: number
    z: number
  }
  lightingIntensity: number
}

interface General {
  selectLanguage: Language
  changeEnglishToJapanese: boolean
  includeTimestampInUserMessage: boolean
  showControlPanel: boolean
  showQuickMenu: boolean
  externalLinkageMode: boolean
  messageReceiverEnabled: boolean
  clientId: string
  useSearchGrounding: boolean
  dynamicRetrievalThreshold: number
  maxPastMessages: number
  useVideoAsBackground: boolean
  temperature: number
  maxTokens: number
  showPresetQuestions: boolean
  chatLogWidth: number
  imageDisplayPosition: 'input' | 'side' | 'icon'
  multiModalMode: 'ai-decide' | 'always' | 'never'
  multiModalAiDecisionPrompt: string
  enableMultiModal: boolean
  colorTheme: 'tonari'
  customModel: boolean
}

export type SettingsState = APIKeys & ModelProvider & Character & General

// Function to get initial values from config files (with env var overrides)
const getInitialValuesFromEnv = (): SettingsState => {
  const config = getAppConfig()

  return {
    // API Keys (from env only - secrets)
    openaiKey:
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_KEY ||
      '',
    anthropicKey: '',
    googleKey: '',
    azureKey:
      process.env.NEXT_PUBLIC_AZURE_API_KEY ||
      process.env.NEXT_PUBLIC_AZURE_KEY ||
      '',
    xaiKey: '',
    groqKey: '',
    cohereKey: '',
    mistralaiKey: '',
    perplexityKey: '',
    fireworksKey: '',
    deepseekKey: '',
    openrouterKey: '',
    lmstudioKey: '',
    ollamaKey: '',
    azureEndpoint: process.env.NEXT_PUBLIC_AZURE_ENDPOINT || '',
    customApiUrl: process.env.NEXT_PUBLIC_CUSTOM_API_URL || '',
    customApiHeaders: process.env.NEXT_PUBLIC_CUSTOM_API_HEADERS || '{}',
    customApiBody: process.env.NEXT_PUBLIC_CUSTOM_API_BODY || '{}',
    customApiStream: true,
    includeSystemMessagesInCustomApi:
      process.env.NEXT_PUBLIC_INCLUDE_SYSTEM_MESSAGES_IN_CUSTOM_API !== 'false',
    customApiIncludeMimeType:
      process.env.NEXT_PUBLIC_CUSTOM_API_INCLUDE_MIME_TYPE !== 'false',

    // Model Provider (from config)
    selectAIService: config.ai.service as AIService,
    selectAIModel: config.ai.model,
    localLlmUrl: process.env.NEXT_PUBLIC_LOCAL_LLM_URL || '',

    // Character (from config)
    characterName: config.character.name,
    showAssistantText: config.general.showAssistantText,
    showCharacterName: config.general.showCharacterName,
    selectedVrmPath: config.character.vrmPath,
    fixedCharacterPosition: false,
    characterPosition: {
      x: 0,
      y: 0,
      z: 0,
      scale: 1,
    },
    characterRotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    lightingIntensity: config.character.lightingIntensity,

    // General (from config)
    selectLanguage: config.general.language as Language,
    changeEnglishToJapanese: config.general.changeEnglishToJapanese,
    includeTimestampInUserMessage: config.general.includeTimestampInUserMessage,
    showControlPanel: config.general.showControlPanel,
    showQuickMenu: config.general.showQuickMenu,
    externalLinkageMode: config.general.externalLinkageMode,
    messageReceiverEnabled: config.general.messageReceiverEnabled,
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID || '',
    useSearchGrounding: config.ai.useSearchGrounding,
    dynamicRetrievalThreshold: config.ai.dynamicRetrievalThreshold,
    maxPastMessages: config.ai.maxPastMessages,
    useVideoAsBackground: config.general.useVideoAsBackground,
    temperature: config.ai.temperature,
    maxTokens: config.ai.maxTokens,
    showPresetQuestions: config.general.showPresetQuestions,
    chatLogWidth: config.general.chatLogWidth,
    imageDisplayPosition: config.multiModal.imageDisplayPosition as
      | 'input'
      | 'side'
      | 'icon',
    multiModalMode: config.multiModal.mode as 'ai-decide' | 'always' | 'never',
    multiModalAiDecisionPrompt:
      process.env.NEXT_PUBLIC_MULTIMODAL_AI_DECISION_PROMPT ||
      'あなたは画像がユーザーの質問や会話の文脈に関連するかどうかを判断するアシスタントです。直近の会話履歴とユーザーメッセージを考慮して、「はい」または「いいえ」のみで答えてください。',
    enableMultiModal: config.multiModal.enabled,
    colorTheme: 'tonari' as const,
    customModel: config.ai.customModel,
  }
}

const settingsStore = create<SettingsState>()(
  persist((set, get) => getInitialValuesFromEnv(), {
    name: 'aitube-kit-settings',
    onRehydrateStorage: () => (state) => {
      // Migrate OpenAI model names when loading from storage
      if (state && state.selectAIService === 'openai' && state.selectAIModel) {
        const migratedModel = migrateOpenAIModelName(state.selectAIModel)
        if (migratedModel !== state.selectAIModel) {
          state.selectAIModel = migratedModel
        }
      }

      // Override with environment variables if the option is enabled
      if (
        state &&
        process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES === 'true'
      ) {
        const envValues = getInitialValuesFromEnv()
        Object.assign(state, envValues)
      }

      // Refresh character name if it's old default
      if (state) {
        const envValues = getInitialValuesFromEnv()
        if (state.characterName === 'CHARACTER' || !state.characterName) {
          state.characterName = envValues.characterName
        }
      }

      // Fallback to default VRM if saved path is not a known model
      if (state) {
        if (
          !VRM_MODELS.includes(
            state.selectedVrmPath as (typeof VRM_MODELS)[number]
          )
        ) {
          state.selectedVrmPath = DEFAULT_VRM
        }
      }
    },
    partialize: (state) => ({
      openaiKey: state.openaiKey,
      anthropicKey: state.anthropicKey,
      googleKey: state.googleKey,
      azureKey: state.azureKey,
      xaiKey: state.xaiKey,
      groqKey: state.groqKey,
      cohereKey: state.cohereKey,
      mistralaiKey: state.mistralaiKey,
      perplexityKey: state.perplexityKey,
      fireworksKey: state.fireworksKey,
      deepseekKey: state.deepseekKey,
      openrouterKey: state.openrouterKey,
      lmstudioKey: state.lmstudioKey,
      ollamaKey: state.ollamaKey,
      azureEndpoint: state.azureEndpoint,
      selectAIService: state.selectAIService,
      selectAIModel: state.selectAIModel,
      localLlmUrl: state.localLlmUrl,
      characterName: state.characterName,
      showAssistantText: state.showAssistantText,
      showCharacterName: state.showCharacterName,
      selectLanguage: state.selectLanguage,
      changeEnglishToJapanese: state.changeEnglishToJapanese,
      includeTimestampInUserMessage: state.includeTimestampInUserMessage,
      externalLinkageMode: state.externalLinkageMode,
      messageReceiverEnabled: state.messageReceiverEnabled,
      clientId: state.clientId,
      useSearchGrounding: state.useSearchGrounding,
      selectedVrmPath: state.selectedVrmPath,
      fixedCharacterPosition: state.fixedCharacterPosition,
      characterPosition: state.characterPosition,
      characterRotation: state.characterRotation,
      lightingIntensity: state.lightingIntensity,
      maxPastMessages: state.maxPastMessages,
      useVideoAsBackground: state.useVideoAsBackground,
      showQuickMenu: state.showQuickMenu,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      showPresetQuestions: state.showPresetQuestions,
      customApiUrl: state.customApiUrl,
      customApiHeaders: state.customApiHeaders,
      customApiBody: state.customApiBody,
      customApiStream: state.customApiStream,
      includeSystemMessagesInCustomApi: state.includeSystemMessagesInCustomApi,
      customApiIncludeMimeType: state.customApiIncludeMimeType,
      chatLogWidth: state.chatLogWidth,
      imageDisplayPosition: state.imageDisplayPosition,
      multiModalMode: state.multiModalMode,
      multiModalAiDecisionPrompt: state.multiModalAiDecisionPrompt,
      enableMultiModal: state.enableMultiModal,
      colorTheme: state.colorTheme,
      customModel: state.customModel,
    }),
  })
)

export default settingsStore
