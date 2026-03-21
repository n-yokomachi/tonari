import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  AIService,
  DEFAULT_VRM,
  Language,
  VRM_MODELS,
} from '../constants/settings'
import { getAppConfig } from '@/lib/config'

interface Character {
  characterName: string
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

export type ModelProvider = 'bedrock' | 'openrouter'
export type TtsEngine = 'aivisspeech' | 'polly'

interface General {
  selectAIService: AIService
  modelProvider: ModelProvider
  selectLanguage: Language
  includeTimestampInUserMessage: boolean
  showControlPanel: boolean
  externalLinkageMode: boolean
  messageReceiverEnabled: boolean
  clientId: string
  maxPastMessages: number
  useVideoAsBackground: boolean
  colorTheme: 'tonari' | 'tonari-dark'
  uiStyle: 'glass' | 'neumorphic' | 'droplet'
  enableAutoCapture: boolean
  voiceEnabled: boolean
  ttsEngine: TtsEngine
  aivisSpeechUrl: string
  aivisSpeechSpeakerId: number
  voiceModel: 'Tomoko' | 'Kazuha'
  ttsVolume: number
  wakeWordEnabled: boolean
  reasoningEnabled: boolean
}

export type SettingsState = Character & General

const getInitialValuesFromEnv = (): SettingsState => {
  const config = getAppConfig()

  return {
    // Character (from config)
    characterName: config.character.name,
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
    selectAIService: config.ai.service as AIService,
    modelProvider: 'bedrock' as ModelProvider,
    selectLanguage: config.general.language as Language,
    includeTimestampInUserMessage: config.general.includeTimestampInUserMessage,
    showControlPanel: config.general.showControlPanel,
    externalLinkageMode: config.general.externalLinkageMode,
    messageReceiverEnabled: config.general.messageReceiverEnabled,
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID || '',
    maxPastMessages: config.ai.maxPastMessages,
    useVideoAsBackground: config.general.useVideoAsBackground,
    colorTheme: 'tonari' as const,
    uiStyle: 'glass' as const,
    enableAutoCapture: true,
    voiceEnabled: false,
    ttsEngine: 'aivisspeech' as TtsEngine,
    aivisSpeechUrl: 'http://localhost:10101',
    aivisSpeechSpeakerId: 888753760,
    voiceModel: 'Tomoko',
    ttsVolume: 50,
    wakeWordEnabled: false,
    reasoningEnabled: false,
  }
}

const settingsStore = create<SettingsState>()(
  persist((set, get) => getInitialValuesFromEnv(), {
    name: 'aitube-kit-settings',
    onRehydrateStorage: () => (state) => {
      // Override with environment variables if the option is enabled
      if (
        state &&
        process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES === 'true'
      ) {
        const envValues = getInitialValuesFromEnv()
        Object.assign(state, envValues)
      }

      // Refresh character name if it's an old or default value
      if (state) {
        const envValues = getInitialValuesFromEnv()
        if (
          state.characterName === 'CHARACTER' ||
          state.characterName === 'Scensei' ||
          !state.characterName
        ) {
          state.characterName = envValues.characterName
        }
      }

      // Fallback to default VRM if saved path is not a known model
      if (state) {
        if (!VRM_MODELS.some((m) => m.path === state.selectedVrmPath)) {
          state.selectedVrmPath = DEFAULT_VRM
        }
      }
    },
    partialize: (state) => ({
      characterName: state.characterName,
      showCharacterName: state.showCharacterName,
      selectedVrmPath: state.selectedVrmPath,
      fixedCharacterPosition: state.fixedCharacterPosition,
      characterPosition: state.characterPosition,
      characterRotation: state.characterRotation,
      lightingIntensity: state.lightingIntensity,
      selectAIService: state.selectAIService,
      modelProvider: state.modelProvider,
      selectLanguage: state.selectLanguage,
      includeTimestampInUserMessage: state.includeTimestampInUserMessage,
      showControlPanel: state.showControlPanel,
      externalLinkageMode: state.externalLinkageMode,
      messageReceiverEnabled: state.messageReceiverEnabled,
      clientId: state.clientId,
      maxPastMessages: state.maxPastMessages,
      useVideoAsBackground: state.useVideoAsBackground,
      colorTheme: state.colorTheme,
      enableAutoCapture: state.enableAutoCapture,
      voiceEnabled: state.voiceEnabled,
      ttsEngine: state.ttsEngine,
      aivisSpeechUrl: state.aivisSpeechUrl,
      aivisSpeechSpeakerId: state.aivisSpeechSpeakerId,
      voiceModel: state.voiceModel,
      ttsVolume: state.ttsVolume,
      wakeWordEnabled: state.wakeWordEnabled,
      reasoningEnabled: state.reasoningEnabled,
    }),
  })
)

export default settingsStore
