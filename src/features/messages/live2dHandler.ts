import { Talk } from './messages'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'

export class Live2DHandler {
  private static idleMotionInterval: NodeJS.Timeout | null = null // インターバルIDを保持

  static async speak(
    audioBuffer: ArrayBuffer,
    talk: Talk,
    isNeedDecode: boolean = true
  ) {
    // Scenseiでは音声出力機能を削除しているため、表情とモーションのみ設定
    const hs = homeStore.getState()
    const ss = settingsStore.getState()
    const live2dViewer = hs.live2dViewer
    if (!live2dViewer) return

    let expression: string | undefined
    let motion: string | undefined
    switch (talk.emotion) {
      case 'neutral':
        expression =
          ss.neutralEmotions[
            Math.floor(Math.random() * ss.neutralEmotions.length)
          ]
        motion = ss.neutralMotionGroup
        break
      case 'happy':
        expression =
          ss.happyEmotions[Math.floor(Math.random() * ss.happyEmotions.length)]
        motion = ss.happyMotionGroup
        break
      case 'sad':
        expression =
          ss.sadEmotions[Math.floor(Math.random() * ss.sadEmotions.length)]
        motion = ss.sadMotionGroup
        break
      case 'angry':
        expression =
          ss.angryEmotions[Math.floor(Math.random() * ss.angryEmotions.length)]
        motion = ss.angryMotionGroup
        break
      case 'relaxed':
        expression =
          ss.relaxedEmotions[
            Math.floor(Math.random() * ss.relaxedEmotions.length)
          ]
        motion = ss.relaxedMotionGroup
        break
      case 'surprised':
        expression =
          ss.surprisedEmotions[
            Math.floor(Math.random() * ss.surprisedEmotions.length)
          ]
        motion = ss.surprisedMotionGroup
    }

    // Live2Dモデルの表情を設定
    if (expression) {
      live2dViewer.expression(expression)
    }
    if (motion) {
      Live2DHandler.stopIdleMotion()
      live2dViewer.motion(motion, undefined, 3)
    }

    // 音声再生なしのため即座に完了
  }

  static async stopSpeaking() {
    const hs = homeStore.getState()
    const live2dViewer = hs.live2dViewer
    if (!live2dViewer) return
    live2dViewer.stopSpeaking()
  }

  static async resetToIdle() {
    // インターバルを停止
    Live2DHandler.stopIdleMotion()

    const hs = homeStore.getState()
    const ss = settingsStore.getState()
    const live2dViewer = hs.live2dViewer
    if (!live2dViewer) return

    // Live2Dモデル以外の場合は早期リターン
    if (ss.modelType !== 'live2d') return

    const idleMotion = ss.idleMotionGroup || 'Idle'
    live2dViewer.motion(idleMotion)
    const expression =
      ss.neutralEmotions[Math.floor(Math.random() * ss.neutralEmotions.length)]
    if (expression) {
      live2dViewer.expression(expression)
    }

    // 5秒ごとのアイドルモーション再生を開始
    Live2DHandler.startIdleMotion(idleMotion)
  }

  // アイドルモーションのインターバル開始
  private static startIdleMotion(idleMotion: string) {
    const ss = settingsStore.getState()
    if (ss.modelType !== 'live2d') return

    this.idleMotionInterval = setInterval(() => {
      const currentSs = settingsStore.getState()
      if (currentSs.modelType !== 'live2d') {
        this.stopIdleMotion()
        return
      }

      const hs = homeStore.getState()
      const viewer = hs.live2dViewer

      // Viewerが存在しない、または破棄済みの場合はインターバルを停止
      if (!viewer || (viewer as any).destroyed) {
        this.stopIdleMotion()
        return
      }

      try {
        viewer.motion(idleMotion)
      } catch (error) {
        console.error('Idle motion failed:', error)
        this.stopIdleMotion()
      }
    }, 5000)
  }

  // アイドルモーションのインターバル停止
  private static stopIdleMotion() {
    if (this.idleMotionInterval) {
      clearInterval(this.idleMotionInterval)
      this.idleMotionInterval = null
    }
  }
}
