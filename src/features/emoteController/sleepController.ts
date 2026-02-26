import { VRMExpressionManager } from '@pixiv/three-vrm'

type SleepPhase = 'awake' | 'drowsy' | 'asleep' | 'waking'

const DROWSY_DURATION = 5 // うつらうつらフェーズの秒数
const DROWSY_CYCLE_SPEED = 2.5 // sin波の周期速度（rad/s）
const WAKING_DURATION = 0.5 // 起床遷移の秒数

/**
 * 睡眠モードの目の開閉アニメーションを制御するクラス。
 *
 * - drowsy: blink を 0.5〜1.0 の間でsin波で振動（うつらうつら）
 * - asleep: blink = 1.0（目を閉じる）
 * - waking: blink 1.0→0 へスムーズに遷移
 */
export class SleepController {
  private _expressionManager: VRMExpressionManager
  private _phase: SleepPhase = 'awake'
  private _elapsedTime: number = 0

  constructor(expressionManager: VRMExpressionManager) {
    this._expressionManager = expressionManager
  }

  public enterDrowsy(): void {
    if (this._phase !== 'awake') return
    this._phase = 'drowsy'
    this._elapsedTime = 0
  }

  public wakeUp(): void {
    if (this._phase === 'awake') return
    this._phase = 'waking'
    this._elapsedTime = 0
  }

  public update(delta: number): void {
    if (this._phase === 'awake') return

    this._elapsedTime += delta

    switch (this._phase) {
      case 'drowsy':
        this._updateDrowsy()
        break
      case 'asleep':
        this._expressionManager.setValue('blink', 1)
        break
      case 'waking':
        this._updateWaking()
        break
    }
  }

  private _updateDrowsy(): void {
    // blink = 0.75 + 0.25 * sin(t * speed) → 0.5〜1.0を振動
    const blink = 0.75 + 0.25 * Math.sin(this._elapsedTime * DROWSY_CYCLE_SPEED)
    this._expressionManager.setValue('blink', blink)

    // 時間超過後、sin波のピーク（blink≈1.0）で自然に睡眠へ移行
    if (this._elapsedTime >= DROWSY_DURATION && blink >= 0.98) {
      this._phase = 'asleep'
      this._expressionManager.setValue('blink', 1)
    }
  }

  private _updateWaking(): void {
    const progress = Math.min(this._elapsedTime / WAKING_DURATION, 1)
    const blink = 1 - progress
    this._expressionManager.setValue('blink', blink)

    if (progress >= 1) {
      this._phase = 'awake'
      this._elapsedTime = 0
    }
  }

  public get isSleeping(): boolean {
    return this._phase === 'drowsy' || this._phase === 'asleep'
  }

  public get phase(): SleepPhase {
    return this._phase
  }
}
