import * as THREE from 'three'
import {
  VRM,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from '@pixiv/three-vrm'
import { AutoLookAt } from './autoLookAt'
import { AutoBlink } from './autoBlink'

/**
 * Expressionを管理するクラス
 *
 * 主に前の表情を保持しておいて次の表情を適用する際に0に戻す作業や、
 * 前の表情が終わるまで待ってから表情適用する役割を持っている。
 */
export class ExpressionController {
  private _autoLookAt: AutoLookAt
  private _autoBlink?: AutoBlink
  private _expressionManager?: VRMExpressionManager
  private _currentEmotion: VRMExpressionPresetName
  private _currentLipSync: {
    preset: VRMExpressionPresetName
    value: number
  } | null
  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._autoLookAt = new AutoLookAt(vrm, camera)
    this._currentEmotion = 'neutral'
    this._currentLipSync = null
    if (vrm.expressionManager) {
      this._expressionManager = vrm.expressionManager
      this._autoBlink = new AutoBlink(vrm.expressionManager)
    }
  }

  public playEmotion(preset: VRMExpressionPresetName) {
    // Skip if the same emotion is already active (avoid flicker on re-set)
    if (preset === this._currentEmotion) return

    if (this._currentEmotion != 'neutral') {
      this._expressionManager?.setValue(this._currentEmotion, 0)
    }

    if (preset == 'neutral') {
      this._autoBlink?.setEnable(true)
      this._currentEmotion = preset
      return
    }

    const t = this._autoBlink?.setEnable(false) || 0
    this._currentEmotion = preset
    setTimeout(() => {
      this._expressionManager?.setValue(preset, 1)
    }, t * 1000)
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    if (this._currentLipSync) {
      this._expressionManager?.setValue(this._currentLipSync.preset, 0)
    }

    // value が 0 の場合は口を閉じる（リップシンクを無効化）
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

    if (this._currentLipSync) {
      const weight =
        this._currentEmotion === 'neutral'
          ? this._currentLipSync.value * 0.5
          : this._currentLipSync.value * 0.25
      this._expressionManager?.setValue(this._currentLipSync.preset, weight)
    }
  }

  /**
   * 現在の感情がneutral以外かどうか
   */
  public get isEmotionActive(): boolean {
    return this._currentEmotion !== 'neutral'
  }
}
