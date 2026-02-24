/**
 * 設定ファイル読み込みユーティリティ
 * Configuration file loader utility
 *
 * 設定の優先順位 / Configuration priority:
 * 1. 環境変数 (NEXT_PUBLIC_* など) - 最優先
 * 2. config/*.json ファイル - デフォルト値
 */

import appConfig from '@/../config/app.json'
import infraConfig from '@/../config/infra.json'

// 型定義
export interface AppConfig {
  general: {
    language: string
    backgroundImagePath: string
    showCharacterName: boolean
    showControlPanel: boolean
    useVideoAsBackground: boolean
    includeTimestampInUserMessage: boolean
    externalLinkageMode: boolean
    messageReceiverEnabled: boolean
    showPresetQuestions: boolean
    presetQuestions: string[]
  }
  character: {
    name: string
    vrmPath: string
    lightingIntensity: number
  }
  ai: {
    service: string
    maxPastMessages: number
  }
}

export interface InfraConfig {
  aws: {
    region: string
    dynamodbTableName: string
  }
  bedrock: {
    modelId: string
  }
  webauthn: {
    rpId: string
    origin: string
  }
}

// 環境変数からの上書きを考慮した値を取得
const getEnvOrConfig = <T>(
  envValue: string | undefined,
  configValue: T,
  parser?: (val: string) => T
): T => {
  if (envValue !== undefined && envValue !== '') {
    if (parser) {
      return parser(envValue)
    }
    return envValue as unknown as T
  }
  return configValue
}

const parseBool = (val: string): boolean => val === 'true'
const parseFloat_ = (val: string): number => parseFloat(val) || 0
const parseInt_ = (val: string): number => parseInt(val, 10) || 0

// アプリケーション設定（環境変数で上書き可能）
export const getAppConfig = (): AppConfig => ({
  general: {
    language: getEnvOrConfig(
      process.env.NEXT_PUBLIC_SELECT_LANGUAGE,
      appConfig.general.language
    ),
    backgroundImagePath: getEnvOrConfig(
      process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH,
      appConfig.general.backgroundImagePath
    ),
    showCharacterName: getEnvOrConfig(
      process.env.NEXT_PUBLIC_SHOW_CHARACTER_NAME,
      appConfig.general.showCharacterName,
      parseBool
    ),
    showControlPanel: getEnvOrConfig(
      process.env.NEXT_PUBLIC_SHOW_CONTROL_PANEL,
      appConfig.general.showControlPanel,
      (val) => val !== 'false'
    ),
    useVideoAsBackground: getEnvOrConfig(
      process.env.NEXT_PUBLIC_USE_VIDEO_AS_BACKGROUND,
      appConfig.general.useVideoAsBackground,
      parseBool
    ),
    includeTimestampInUserMessage: getEnvOrConfig(
      process.env.NEXT_PUBLIC_INCLUDE_TIMESTAMP_IN_USER_MESSAGE,
      appConfig.general.includeTimestampInUserMessage,
      parseBool
    ),
    externalLinkageMode: getEnvOrConfig(
      process.env.NEXT_PUBLIC_EXTERNAL_LINKAGE_MODE,
      appConfig.general.externalLinkageMode,
      parseBool
    ),
    messageReceiverEnabled: getEnvOrConfig(
      process.env.NEXT_PUBLIC_MESSAGE_RECEIVER_ENABLED,
      appConfig.general.messageReceiverEnabled,
      parseBool
    ),
    showPresetQuestions: getEnvOrConfig(
      process.env.NEXT_PUBLIC_SHOW_PRESET_QUESTIONS,
      appConfig.general.showPresetQuestions,
      (val) => val !== 'false'
    ),
    presetQuestions: process.env.NEXT_PUBLIC_PRESET_QUESTIONS
      ? process.env.NEXT_PUBLIC_PRESET_QUESTIONS.split(',').map((s) => s.trim())
      : appConfig.general.presetQuestions,
  },
  character: {
    name: getEnvOrConfig(
      process.env.NEXT_PUBLIC_CHARACTER_NAME,
      appConfig.character.name
    ),
    vrmPath: getEnvOrConfig(
      process.env.NEXT_PUBLIC_SELECTED_VRM_PATH,
      appConfig.character.vrmPath
    ),
    lightingIntensity: getEnvOrConfig(
      process.env.NEXT_PUBLIC_LIGHTING_INTENSITY,
      appConfig.character.lightingIntensity,
      parseFloat_
    ),
  },
  ai: {
    service: getEnvOrConfig(
      process.env.NEXT_PUBLIC_SELECT_AI_SERVICE,
      appConfig.ai.service
    ),
    maxPastMessages: getEnvOrConfig(
      process.env.NEXT_PUBLIC_MAX_PAST_MESSAGES,
      appConfig.ai.maxPastMessages,
      parseInt_
    ),
  },
})

// インフラ設定（環境変数で上書き可能）
export const getInfraConfig = (): InfraConfig => ({
  aws: {
    region: infraConfig.aws.region,
    dynamodbTableName: getEnvOrConfig(
      process.env.DYNAMODB_TABLE_NAME,
      infraConfig.aws.dynamodbTableName
    ),
  },
  bedrock: {
    modelId: getEnvOrConfig(
      process.env.BEDROCK_MODEL_ID,
      infraConfig.bedrock.modelId
    ),
  },
  webauthn: {
    rpId: getEnvOrConfig(process.env.WEBAUTHN_RP_ID, infraConfig.webauthn.rpId),
    origin: getEnvOrConfig(
      process.env.WEBAUTHN_ORIGIN,
      infraConfig.webauthn.origin
    ),
  },
})

// 直接エクスポート（便利用）
export { appConfig, infraConfig }
