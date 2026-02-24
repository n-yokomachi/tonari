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

interface General {
  selectAIService: AIService
  selectLanguage: Language
  includeTimestampInUserMessage: boolean
  showControlPanel: boolean
  externalLinkageMode: boolean
  messageReceiverEnabled: boolean
  clientId: string
  maxPastMessages: number
  useVideoAsBackground: boolean
  showPresetQuestions: boolean
  colorTheme: 'tonari'
  enableAutoCapture: boolean
  voiceEnabled: boolean
  voiceModel: 'Tomoko' | 'Kazuha'
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
    selectLanguage: config.general.language as Language,
    includeTimestampInUserMessage: config.general.includeTimestampInUserMessage,
    showControlPanel: config.general.showControlPanel,
    externalLinkageMode: config.general.externalLinkageMode,
    messageReceiverEnabled: config.general.messageReceiverEnabled,
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID || '',
    maxPastMessages: config.ai.maxPastMessages,
    useVideoAsBackground: config.general.useVideoAsBackground,
    showPresetQuestions: config.general.showPresetQuestions,
    colorTheme: 'tonari' as const,
    enableAutoCapture: true,
    voiceEnabled: false,
    voiceModel: 'Tomoko',
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
      characterName: state.characterName,
      showCharacterName: state.showCharacterName,
      selectedVrmPath: state.selectedVrmPath,
      fixedCharacterPosition: state.fixedCharacterPosition,
      characterPosition: state.characterPosition,
      characterRotation: state.characterRotation,
      lightingIntensity: state.lightingIntensity,
      selectAIService: state.selectAIService,
      selectLanguage: state.selectLanguage,
      includeTimestampInUserMessage: state.includeTimestampInUserMessage,
      showControlPanel: state.showControlPanel,
      externalLinkageMode: state.externalLinkageMode,
      messageReceiverEnabled: state.messageReceiverEnabled,
      clientId: state.clientId,
      maxPastMessages: state.maxPastMessages,
      useVideoAsBackground: state.useVideoAsBackground,
      showPresetQuestions: state.showPresetQuestions,
      colorTheme: state.colorTheme,
      enableAutoCapture: state.enableAutoCapture,
      voiceEnabled: state.voiceEnabled,
      voiceModel: state.voiceModel,
    }),
  })
)

export default settingsStore
