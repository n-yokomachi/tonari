import * as THREE from 'three'
import { VRMExpressionManager, VRMHumanoid } from '@pixiv/three-vrm'

type SleepPhase = 'awake' | 'drowsy' | 'asleep' | 'waking'
type DrowsyStep = 'closing' | 'closed' | 'opening' | 'open'

const WAKING_DURATION = 0.5 // 起床遷移の秒数

/** うつらうつらサイクルの設定 */
const DROWSY_CLOSE_DURATION = 1.0 // 目を閉じる時間
const DROWSY_CLOSED_HOLD = 0.4 // 閉じた状態の保持時間
const DROWSY_OPEN_DURATION = 0.15 // 目を開ける時間（すっと開く）
const DROWSY_OPEN_HOLD = 0.8 // 開いた状態の保持時間
/** 各サイクルの開き具合（blink値：0=全開, 1=全閉） */
const DROWSY_OPEN_LEVELS = [0.1, 0.3, 0.55]

/** 首の傾き設定 */
const NECK_FORWARD_ANGLE = 0.12 // 前傾（X軸）約7度
const NECK_LEFT_ANGLE = 0.08 // 左傾き（Z軸）約5度
const NECK_LERP_SPEED = 2.0 // lerpの速度係数

const easeIn = (t: number) => t * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

/** 睡眠時の首の目標クォータニオン（前傾＋左傾き） */
const _sleepNeckQ = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(NECK_FORWARD_ANGLE, 0, NECK_LEFT_ANGLE)
)
const _identityQ = new THREE.Quaternion()

/**
 * 睡眠モードの目の開閉アニメーションと首の前傾を制御するクラス。
 *
 * - drowsy: 段階的に目が閉じていくサイクル＋首が徐々に前傾＋左傾き
 * - asleep: blink = 1.0 + 首を前傾＋左傾き
 * - waking: blink 1.0→0 + 首を戻す
 */
export class SleepController {
  private _expressionManager: VRMExpressionManager
  private _humanoid: VRMHumanoid
  private _phase: SleepPhase = 'awake'
  private _elapsedTime: number = 0

  /** うつらうつらサイクル管理 */
  private _drowsyStep: DrowsyStep = 'closing'
  private _drowsyCycle: number = 0
  private _stepElapsed: number = 0
  private _blinkFrom: number = 0
  private _blinkTo: number = 1

  /** 首の傾き（0=直立, 1=最大傾き）: 目標値とスムーズ追従値 */
  private _neckTiltTarget: number = 0
  private _neckTiltCurrent: number = 0

  constructor(expressionManager: VRMExpressionManager, humanoid: VRMHumanoid) {
    this._expressionManager = expressionManager
    this._humanoid = humanoid
  }

  public enterDrowsy(): void {
    if (this._phase !== 'awake') return
    this._phase = 'drowsy'
    this._elapsedTime = 0
    this._drowsyCycle = 0
    this._stepElapsed = 0
    this._drowsyStep = 'closing'
    this._blinkFrom = 0
    this._blinkTo = 1
    this._neckTiltTarget = 0
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
        this._updateDrowsy(delta)
        break
      case 'asleep':
        this._expressionManager.setValue('blink', 1)
        this._neckTiltTarget = 1
        break
      case 'waking':
        this._updateWaking()
        break
    }

    // 首の傾きをスムーズに追従
    this._neckTiltCurrent +=
      (this._neckTiltTarget - this._neckTiltCurrent) *
      Math.min(delta * NECK_LERP_SPEED, 1)
  }

  private _updateDrowsy(delta: number): void {
    this._stepElapsed += delta

    // 首の傾き目標をサイクル進行に応じて設定
    const totalCycles = DROWSY_OPEN_LEVELS.length
    this._neckTiltTarget = Math.min(this._drowsyCycle / totalCycles, 1)

    switch (this._drowsyStep) {
      case 'closing': {
        const t = Math.min(this._stepElapsed / DROWSY_CLOSE_DURATION, 1)
        const blink =
          this._blinkFrom + (this._blinkTo - this._blinkFrom) * easeIn(t)
        this._expressionManager.setValue('blink', blink)
        if (t >= 1) {
          this._drowsyStep = 'closed'
          this._stepElapsed = 0
        }
        break
      }
      case 'closed': {
        this._expressionManager.setValue('blink', 1)
        if (this._stepElapsed >= DROWSY_CLOSED_HOLD) {
          if (this._drowsyCycle >= DROWSY_OPEN_LEVELS.length) {
            this._phase = 'asleep'
            this._neckTiltTarget = 1
            this._expressionManager.setValue('blink', 1)
            return
          }
          this._drowsyStep = 'opening'
          this._stepElapsed = 0
          this._blinkFrom = 1
          this._blinkTo = DROWSY_OPEN_LEVELS[this._drowsyCycle]
        }
        break
      }
      case 'opening': {
        const t = Math.min(this._stepElapsed / DROWSY_OPEN_DURATION, 1)
        const blink =
          this._blinkFrom + (this._blinkTo - this._blinkFrom) * easeOut(t)
        this._expressionManager.setValue('blink', blink)
        if (t >= 1) {
          this._drowsyStep = 'open'
          this._stepElapsed = 0
        }
        break
      }
      case 'open': {
        this._expressionManager.setValue(
          'blink',
          DROWSY_OPEN_LEVELS[this._drowsyCycle]
        )
        if (this._stepElapsed >= DROWSY_OPEN_HOLD) {
          this._drowsyCycle++
          this._drowsyStep = 'closing'
          this._stepElapsed = 0
          this._blinkFrom = DROWSY_OPEN_LEVELS[this._drowsyCycle - 1]
          this._blinkTo = 1
        }
        break
      }
    }
  }

  private _updateWaking(): void {
    const progress = Math.min(this._elapsedTime / WAKING_DURATION, 1)
    const eased = easeOut(progress)
    this._expressionManager.setValue('blink', 1 - eased)

    // 起床時は直接currentを設定（lerp追従だと二重スムージングでカクつく）
    this._neckTiltCurrent = 1 - eased
    this._neckTiltTarget = this._neckTiltCurrent

    if (progress >= 1) {
      this._phase = 'awake'
      this._elapsedTime = 0
      this._neckTiltTarget = 0
      this._neckTiltCurrent = 0
    }
  }

  /** 首の傾きをrawボーンに適用（vrm.update()後に呼ぶこと） */
  public applyNeckTilt(): void {
    if (this._phase === 'awake') return
    const neckNode = this._humanoid.getRawBoneNode('neck')
    if (!neckNode) return

    const tiltQ = _identityQ.clone().slerp(_sleepNeckQ, this._neckTiltCurrent)
    neckNode.quaternion.multiply(tiltQ)
  }

  public get isSleeping(): boolean {
    return this._phase === 'drowsy' || this._phase === 'asleep'
  }

  public get phase(): SleepPhase {
    return this._phase
  }
}
