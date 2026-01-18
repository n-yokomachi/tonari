import { Talk } from './messages'
import homeStore from '@/features/stores/home'
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
 * キャラクターの表情を設定し、口パク（リップシンク）アニメーションを実行する
 * 音声出力は無効化されているが、表情と口パクは動作する
 */
export const speakCharacter = (
  _sessionId: string,
  talk: Talk,
  onStart?: () => void,
  onComplete?: () => void
) => {
  onStart?.()

  const { viewer } = homeStore.getState()

  // 表情を適用
  if (viewer?.model?.emoteController) {
    viewer.model.emoteController.playEmotion(talk.emotion)
  }

  // 前回の口パクアニメーションがあれば停止
  if (lipSyncTimeout) {
    clearTimeout(lipSyncTimeout)
  }

  // 口パク中は発話中状態にする
  homeStore.setState({ isSpeaking: true })

  // テキストを母音シーケンスに変換
  const vowelSequence = textToVowelSequence(talk.message)

  // 1音あたりの時間（ミリ秒）- 自然な発話速度に近づける
  const msPerPhoneme = 80

  // 現在の母音インデックス
  let currentIndex = 0

  // 前の母音表情をリセットする関数
  const resetLipSync = () => {
    if (viewer?.model?.emoteController) {
      ;(['aa', 'ih', 'ou', 'ee', 'oh'] as VRMExpressionPresetName[]).forEach(
        (v) => {
          viewer.model!.emoteController!.lipSync(v, 0)
        }
      )
    }
  }

  // 口パクアニメーションを実行する関数
  const animateLipSync = () => {
    if (currentIndex >= vowelSequence.length) {
      // アニメーション完了
      resetLipSync()
      homeStore.setState({ isSpeaking: false })
      onComplete?.()
      return
    }

    const currentVowel = vowelSequence[currentIndex]

    if (viewer?.model?.emoteController) {
      // 前の母音をリセット
      resetLipSync()

      if (currentVowel === 'pause') {
        // 一時停止：口を閉じたまま少し待つ（句読点は長めに）
        lipSyncTimeout = setTimeout(() => {
          currentIndex++
          animateLipSync()
        }, msPerPhoneme * 3)
      } else if (currentVowel === 'closed') {
        // 「ん」：口を閉じる
        lipSyncTimeout = setTimeout(() => {
          currentIndex++
          animateLipSync()
        }, msPerPhoneme)
      } else {
        // 母音を適用
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
      // emoteControllerがない場合は完了
      homeStore.setState({ isSpeaking: false })
      onComplete?.()
    }
  }

  // アニメーション開始
  animateLipSync()
}

/**
 * テスト音声再生（無効化）
 */
export const testVoice = async () => {
  // 音声機能は無効化されています
}
