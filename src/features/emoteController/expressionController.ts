import * as THREE from 'three'
import {
  VRM,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from '@pixiv/three-vrm'
import { AutoLookAt } from './autoLookAt'
import { AutoBlink } from './autoBlink'

/** Expression weight transition speed (per second). Higher = faster transition. */
const EXPRESSION_LERP_SPEED = 3.0

/**
 * Expressionを管理するクラス
 *
 * 主に前の表情を保持しておいて次の表情を適用する際に0に戻す作業や、
 * 前の表情が終わるまで待ってから表情適用する役割を持っている。
 * 表情の切り替えはlerpで滑らかに遷移する。
 */
export class ExpressionController {
  private _autoLookAt: AutoLookAt
  private _autoBlink?: AutoBlink
  private _expressionManager?: VRMExpressionManager
  private _currentEmotion: VRMExpressionPresetName
  private _previousEmotion: VRMExpressionPresetName
  private _currentWeight: number
  private _targetWeight: number
  private _fadeOutWeight: number
  private _currentLipSync: {
    preset: VRMExpressionPresetName
    value: number
  } | null
  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._autoLookAt = new AutoLookAt(vrm, camera)
    this._currentEmotion = 'neutral'
    this._previousEmotion = 'neutral'
    this._currentWeight = 0
    this._targetWeight = 0
    this._fadeOutWeight = 0
    this._currentLipSync = null
    if (vrm.expressionManager) {
      this._expressionManager = vrm.expressionManager
      this._autoBlink = new AutoBlink(vrm.expressionManager)
    }
  }

  public playEmotion(preset: VRMExpressionPresetName, weight: number = 1) {
    if (preset === this._currentEmotion) return

    this._previousEmotion = this._currentEmotion
    this._fadeOutWeight = this._currentWeight

    this._currentEmotion = preset

    if (preset === 'neutral') {
      this._targetWeight = 0
      this._autoBlink?.setEnable(true)
    } else {
      this._targetWeight = Math.min(Math.max(weight, 0), 1)
      this._autoBlink?.setEnable(false)
    }

    this._currentWeight = 0
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    if (this._currentLipSync) {
      this._expressionManager?.setValue(this._currentLipSync.preset, 0)
    }

    if (value === 0) {
      this._currentLipSync = null
      return
    }

    this._currentLipSync = {
      preset,
      value,
    }
  }

  public update(delta: number, skipAutoBlink: boolean = false) {
    if (this._autoBlink && !skipAutoBlink) {
      this._autoBlink.update(delta)
    }

    this._updateEmotionTransition(delta)

    if (this._currentLipSync) {
      const weight =
        this._currentEmotion === 'neutral' && this._fadeOutWeight <= 0
          ? this._currentLipSync.value * 0.5
          : this._currentLipSync.value * 0.25
      this._expressionManager?.setValue(this._currentLipSync.preset, weight)
    }
  }

  private _updateEmotionTransition(delta: number) {
    if (!this._expressionManager) return

    const step = delta * EXPRESSION_LERP_SPEED

    // Fade out previous emotion
    if (this._fadeOutWeight > 0 && this._previousEmotion !== 'neutral') {
      this._fadeOutWeight = Math.max(this._fadeOutWeight - step, 0)
      this._expressionManager.setValue(
        this._previousEmotion,
        this._fadeOutWeight
      )
    }

    // Fade in current emotion
    if (this._currentEmotion !== 'neutral') {
      this._currentWeight = Math.min(
        this._currentWeight + step,
        this._targetWeight
      )
      this._expressionManager.setValue(
        this._currentEmotion,
        this._currentWeight
      )
    }
  }

  public setAutoBlinkEnable(enable: boolean): void {
    this._autoBlink?.setEnable(enable)
  }

  /**
   * 現在の感情がneutral以外かどうか
   */
  public get isEmotionActive(): boolean {
    return this._currentEmotion !== 'neutral' || this._fadeOutWeight > 0
  }
}
