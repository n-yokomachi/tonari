import { Talk } from './messages'
import { SpeakQueue } from './speakQueue'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { VRMExpressionPresetName } from '@pixiv/three-vrm'

// 口パクアニメーション用のタイマーID
let lipSyncTimeout: ReturnType<typeof setTimeout> | null = null

// 日本語のひらがな・カタカナを母音に変換するマッピング
const kanaToVowel: Record<string, VRMExpressionPresetName> = {
  // あ行 (a)
  あ: 'aa',
  ア: 'aa',
  a: 'aa',
  // い行 (i)
  い: 'ih',
  イ: 'ih',
  i: 'ih',
  // う行 (u)
  う: 'ou',
  ウ: 'ou',
  u: 'ou',
  // え行 (e)
  え: 'ee',
  エ: 'ee',
  e: 'ee',
  // お行 (o)
  お: 'oh',
  オ: 'oh',
  o: 'oh',
  // か行
  か: 'aa',
  カ: 'aa',
  き: 'ih',
  キ: 'ih',
  く: 'ou',
  ク: 'ou',
  け: 'ee',
  ケ: 'ee',
  こ: 'oh',
  コ: 'oh',
  // さ行
  さ: 'aa',
  サ: 'aa',
  し: 'ih',
  シ: 'ih',
  す: 'ou',
  ス: 'ou',
  せ: 'ee',
  セ: 'ee',
  そ: 'oh',
  ソ: 'oh',
  // た行
  た: 'aa',
  タ: 'aa',
  ち: 'ih',
  チ: 'ih',
  つ: 'ou',
  ツ: 'ou',
  て: 'ee',
  テ: 'ee',
  と: 'oh',
  ト: 'oh',
  // な行
  な: 'aa',
  ナ: 'aa',
  に: 'ih',
  ニ: 'ih',
  ぬ: 'ou',
  ヌ: 'ou',
  ね: 'ee',
  ネ: 'ee',
  の: 'oh',
  ノ: 'oh',
  // は行
  は: 'aa',
  ハ: 'aa',
  ひ: 'ih',
  ヒ: 'ih',
  ふ: 'ou',
  フ: 'ou',
  へ: 'ee',
  ヘ: 'ee',
  ほ: 'oh',
  ホ: 'oh',
  // ま行
  ま: 'aa',
  マ: 'aa',
  み: 'ih',
  ミ: 'ih',
  む: 'ou',
  ム: 'ou',
  め: 'ee',
  メ: 'ee',
  も: 'oh',
  モ: 'oh',
  // や行
  や: 'aa',
  ヤ: 'aa',
  ゆ: 'ou',
  ユ: 'ou',
  よ: 'oh',
  ヨ: 'oh',
  // ら行
  ら: 'aa',
  ラ: 'aa',
  り: 'ih',
  リ: 'ih',
  る: 'ou',
  ル: 'ou',
  れ: 'ee',
  レ: 'ee',
  ろ: 'oh',
  ロ: 'oh',
  // わ行
  わ: 'aa',
  ワ: 'aa',
  を: 'oh',
  ヲ: 'oh',
  // が行
  が: 'aa',
  ガ: 'aa',
  ぎ: 'ih',
  ギ: 'ih',
  ぐ: 'ou',
  グ: 'ou',
  げ: 'ee',
  ゲ: 'ee',
  ご: 'oh',
  ゴ: 'oh',
  // ざ行
  ざ: 'aa',
  ザ: 'aa',
  じ: 'ih',
  ジ: 'ih',
  ず: 'ou',
  ズ: 'ou',
  ぜ: 'ee',
  ゼ: 'ee',
  ぞ: 'oh',
  ゾ: 'oh',
  // だ行
  だ: 'aa',
  ダ: 'aa',
  ぢ: 'ih',
  ヂ: 'ih',
  づ: 'ou',
  ヅ: 'ou',
  で: 'ee',
  デ: 'ee',
  ど: 'oh',
  ド: 'oh',
  // ば行
  ば: 'aa',
  バ: 'aa',
  び: 'ih',
  ビ: 'ih',
  ぶ: 'ou',
  ブ: 'ou',
  べ: 'ee',
  ベ: 'ee',
  ぼ: 'oh',
  ボ: 'oh',
  // ぱ行
  ぱ: 'aa',
  パ: 'aa',
  ぴ: 'ih',
  ピ: 'ih',
  ぷ: 'ou',
  プ: 'ou',
  ぺ: 'ee',
  ペ: 'ee',
  ぽ: 'oh',
  ポ: 'oh',
}

// 口パクのタイプ
type LipSyncType = VRMExpressionPresetName | 'closed' | 'pause'

/**
 * テキストを母音シーケンスに変換する
 */
const textToVowelSequence = (text: string): LipSyncType[] => {
  const sequence: LipSyncType[] = []

  for (const char of text) {
    const vowel = kanaToVowel[char]
    if (vowel) {
      sequence.push(vowel)
    } else if (
      char === '、' ||
      char === '。' ||
      char === '！' ||
      char === '？'
    ) {
      // 句読点は一時停止
      sequence.push('pause')
    } else if (char === 'ん' || char === 'ン') {
      // 「ん」は口を閉じる
      sequence.push('closed')
    }
    // その他の文字（漢字、記号など）はスキップ
    // 実際の読み上げでは漢字も発音されるが、簡易実装のためスキップ
  }

  // シーケンスが空の場合はデフォルトの口パクを追加
  if (sequence.length === 0) {
    // 漢字のみの場合のフォールバック：文字数に基づいてランダムな母音を生成
    const vowels: VRMExpressionPresetName[] = ['aa', 'ih', 'ou', 'ee', 'oh']
    const charCount = text.replace(/[、。！？\s]/g, '').length
    for (let i = 0; i < charCount; i++) {
      sequence.push(vowels[i % vowels.length])
    }
  }

  return sequence
}

/**
 * キャラクターの表情を設定し、リップシンクアニメーションを実行する
 * voiceEnabled=ON: TTS APIで音声合成→SpeakQueueで再生→音声波形リップシンク
 * voiceEnabled=OFF: テキストベースの母音リップシンク（従来動作）
 */
export const speakCharacter = (
  sessionId: string,
  talk: Talk,
  onStart?: () => void,
  onComplete?: () => void
) => {
  const { voiceEnabled } = settingsStore.getState()

  if (voiceEnabled) {
    speakWithAudio(sessionId, talk, onStart, onComplete)
  } else {
    speakWithTextLipSync(talk, onStart, onComplete)
  }
}

/**
 * 音声パス: TTS APIで音声を合成し、SpeakQueue経由で再生する
 * fetchを即座に開始しつつ、タスクを同期的にキューに追加することで
 * 文の再生順序を保証する
 */
const speakWithAudio = (
  sessionId: string,
  talk: Talk,
  onStart?: () => void,
  onComplete?: () => void
) => {
  onStart?.()

  const { viewer } = homeStore.getState()

  // Set emotion immediately (before waiting for audio fetch)
  // This ensures gesture skipEyeClose works from the first frame
  viewer.model?.emoteController?.playEmotion(talk.emotion)

  viewer.model?.initLipSync()

  const { voiceModel } = settingsStore.getState()

  // TTS fetchを即座に開始（Promiseとして保持）
  const audioPromise = fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: talk.message,
      emotion: talk.emotion,
      voice: voiceModel,
    }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`)
    }
    return response.arrayBuffer()
  })

  // タスクを即座にキューに追加（順序を保証）
  // audioBufferはPromiseのまま渡し、キュー処理時に解決される
  const queue = SpeakQueue.getInstance()
  queue.checkSessionId(sessionId)
  queue.addTask({
    sessionId,
    audioBuffer: audioPromise,
    talk,
    isNeedDecode: false,
    onComplete,
  })
}

/**
 * テキストパス: テキストベースの母音リップシンクアニメーション
 */
const speakWithTextLipSync = (
  talk: Talk,
  onStart?: () => void,
  onComplete?: () => void
) => {
  onStart?.()

  const { viewer } = homeStore.getState()

  if (viewer?.model?.emoteController) {
    viewer.model.emoteController.playEmotion(talk.emotion)
  }

  if (lipSyncTimeout) {
    clearTimeout(lipSyncTimeout)
  }

  homeStore.setState({ isSpeaking: true })

  const vowelSequence = textToVowelSequence(talk.message)
  const msPerPhoneme = 80
  let currentIndex = 0

  const resetLipSync = () => {
    if (viewer?.model?.emoteController) {
      ;(['aa', 'ih', 'ou', 'ee', 'oh'] as VRMExpressionPresetName[]).forEach(
        (v) => {
          viewer.model!.emoteController!.lipSync(v, 0)
        }
      )
    }
  }

  const animateLipSync = () => {
    if (currentIndex >= vowelSequence.length) {
      resetLipSync()
      homeStore.setState({ isSpeaking: false })
      onComplete?.()
      return
    }

    const currentVowel = vowelSequence[currentIndex]

    if (viewer?.model?.emoteController) {
      resetLipSync()

      if (currentVowel === 'pause') {
        lipSyncTimeout = setTimeout(() => {
          currentIndex++
          animateLipSync()
        }, msPerPhoneme * 3)
      } else if (currentVowel === 'closed') {
        lipSyncTimeout = setTimeout(() => {
          currentIndex++
          animateLipSync()
        }, msPerPhoneme)
      } else {
        viewer.model.emoteController.lipSync(
          currentVowel as VRMExpressionPresetName,
          0.8
        )
        lipSyncTimeout = setTimeout(() => {
          currentIndex++
          animateLipSync()
        }, msPerPhoneme)
      }
    } else {
      homeStore.setState({ isSpeaking: false })
      onComplete?.()
    }
  }

  animateLipSync()
}
