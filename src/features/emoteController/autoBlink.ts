import { VRMExpressionManager } from '@pixiv/three-vrm'

// 瞬きフェーズごとの秒数
const CLOSING_DURATION = 0.08 // 閉じる（速め）
const CLOSED_DURATION = 0.05 // 閉じた状態を保持
const OPENING_DURATION = 0.12 // 開く（閉じるより少しゆっくり）
const MIN_OPEN_INTERVAL = 3.0 // 開いている最小時間
const MAX_OPEN_INTERVAL = 6.0 // 開いている最大時間

type BlinkPhase = 'open' | 'closing' | 'closed' | 'opening'

// ease-in（閉じる時：加速）
const easeIn = (t: number) => t * t

// ease-out（開く時：減速）
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

/**
 * 自動瞬きを制御するクラス
 */
export class AutoBlink {
  private _expressionManager: VRMExpressionManager
  private _isAutoBlink: boolean
  private _phase: BlinkPhase
  private _elapsedTime: number
  private _phaseDuration: number

  constructor(expressionManager: VRMExpressionManager) {
    this._expressionManager = expressionManager
    this._isAutoBlink = true
    this._phase = 'open'
    this._elapsedTime = 0
    this._phaseDuration = this._randomOpenInterval()
  }

  /**
   * 自動瞬きをON/OFFする。
   *
   * 目を閉じている時に感情表現を入れてしまうと不自然になるので、
   * 目が開くまでの秒を返し、その時間待ってから感情表現を適用する。
   */
  public setEnable(isAuto: boolean) {
    this._isAutoBlink = isAuto

    if (!isAuto && this._phase !== 'open') {
      // 現在のフェーズの残り時間を返す
      const remaining = Math.max(0, this._phaseDuration - this._elapsedTime)
      // 瞬き完了後にリセット
      setTimeout(() => {
        this._phase = 'open'
        this._elapsedTime = 0
        this._phaseDuration = this._randomOpenInterval()
        this._expressionManager.setValue('blink', 0)
      }, remaining * 1000)
      return remaining
    }

    return 0
  }

  public update(delta: number) {
    if (!this._isAutoBlink) return

    this._elapsedTime += delta

    switch (this._phase) {
      case 'open':
        if (this._elapsedTime >= this._phaseDuration) {
          this._transition('closing', CLOSING_DURATION)
        }
        break

      case 'closing': {
        const progress = Math.min(1, this._elapsedTime / this._phaseDuration)
        this._expressionManager.setValue('blink', easeIn(progress))
        if (progress >= 1) {
          this._transition('closed', CLOSED_DURATION)
        }
        break
      }

      case 'closed':
        this._expressionManager.setValue('blink', 1)
        if (this._elapsedTime >= this._phaseDuration) {
          this._transition('opening', OPENING_DURATION)
        }
        break

      case 'opening': {
        const progress = Math.min(1, this._elapsedTime / this._phaseDuration)
        this._expressionManager.setValue('blink', 1 - easeOut(progress))
        if (progress >= 1) {
          this._expressionManager.setValue('blink', 0)
          this._transition('open', this._randomOpenInterval())
        }
        break
      }
    }
  }

  private _transition(phase: BlinkPhase, duration: number) {
    this._phase = phase
    this._elapsedTime = 0
    this._phaseDuration = duration
  }

  private _randomOpenInterval(): number {
    return (
      MIN_OPEN_INTERVAL +
      Math.random() * (MAX_OPEN_INTERVAL - MIN_OPEN_INTERVAL)
    )
  }
}
