import { Talk } from './messages'
import { Language, VoiceLanguage } from '@/features/constants/settings'

export async function synthesizeVoiceGoogleApi(
  talk: Talk,
  googleTtsType: string,
  selectLanguage: Language
) {
  try {
    const googleTtsTypeByLang = getGoogleTtsType(googleTtsType, selectLanguage)
    const languageCode = getVoiceLanguageCode(selectLanguage)

    const body = {
      message: talk.message,
      ttsType: googleTtsTypeByLang,
      languageCode,
    }

    const res = await fetch('/api/tts-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(
        `Google Text-to-Speech APIからの応答が異常です。ステータスコード: ${res.status}`
      )
    }

    const data = await res.json()

    // Base64文字列をデコードしてArrayBufferに変換
    const binaryStr = atob(data.audio)
    const uint8Array = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      uint8Array[i] = binaryStr.charCodeAt(i)
    }
    const arrayBuffer: ArrayBuffer = uint8Array.buffer

    return arrayBuffer
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Google Text-to-Speechでエラーが発生しました: ${error.message}`
      )
    } else {
      throw new Error('Google Text-to-Speechで不明なエラーが発生しました')
    }
  }
}

function getGoogleTtsType(
  googleTtsType: string,
  selectLanguage: Language
): string {
  if (googleTtsType && googleTtsType.trim()) return googleTtsType

  switch (selectLanguage) {
    case 'ja':
      return 'ja-JP-Standard-B'
    case 'en':
      return 'en-US-Neural2-F'
    default:
      return 'en-US-Neural2-F'
  }
}

function getVoiceLanguageCode(selectLanguage: Language): VoiceLanguage {
  switch (selectLanguage) {
    case 'ja':
      return 'ja-JP'
    case 'en':
      return 'en-US'
    default:
      return 'en-US'
  }
}
