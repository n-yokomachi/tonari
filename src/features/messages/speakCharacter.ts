import { Talk } from './messages'

/**
 * 音声合成機能は無効化されています。
 * この関数は何もせずに即座にコールバックを呼び出します。
 */
export const speakCharacter = (
  _sessionId: string,
  _talk: Talk,
  onStart?: () => void,
  onComplete?: () => void
) => {
  onStart?.()
  onComplete?.()
}

/**
 * テスト音声再生（無効化）
 */
export const testVoice = async () => {
  // 音声機能は無効化されています
}
