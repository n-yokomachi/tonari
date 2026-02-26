import * as THREE from 'three'
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import {
  GestureType,
  GestureDefinition,
  gestureDefinitions,
  VrmaPose,
} from './gestures'

export type { GestureType }

/** playGesture() に渡せるオプション（ジェスチャー定義のデフォルト値をオーバーライド） */
export interface GesturePlayOptions {
  /** ポーズ保持時間（秒）。省略時はジェスチャー定義の holdDuration を使用 */
  holdDuration?: number
  /** 再生速度の倍率。1.0 が等速、0.5 で半速、2.0 で倍速。省略時は 1.0 */
  speed?: number
}

/**
 * VRM bone rotation controller for playing gesture animations.
 *
 * Supports two modes:
 * - Raw bone gestures: Euler-based rotations applied after vrm.update() via multiply
 * - VRMA gestures: Pose-tool rotations applied to normalized bones before vrm.update()
 */
export class GestureController {
  private _vrm: VRM
  private _currentGesture: GestureType = 'none'
  private _isPlaying: boolean = false
  private _currentKeyframeIndex: number = 0
  private _keyframeElapsedTime: number = 0
  private _isReturning: boolean = false
  private _isHolding: boolean = false
  private _gestureBlendWeight: number = 0
  private _gestureJustEnded: boolean = false

  private _currentGestureRotations: Map<
    VRMHumanBoneName,
    { from: THREE.Quaternion; to: THREE.Quaternion }
  > = new Map()

  private _persistedRotations: Map<VRMHumanBoneName, THREE.Quaternion> =
    new Map()

  private _gestures: ReadonlyMap<GestureType, GestureDefinition>

  /** Pre-loaded VRMA pose data (normalized bone rotations, one per keyframe) */
  private _vrmaPoses: Map<GestureType, VrmaPose[]> = new Map()

  /** VRMAジェスチャーが変更するボーン名（復元対象） */
  private _vrmaBonesToReset: VRMHumanBoneName[] = []

  /** slerp前のクォータニオン保存（次フレームで復元するため） */
  private _preSlerpQuats: Map<VRMHumanBoneName, THREE.Quaternion> = new Map()

  /** 現在再生中のジェスチャーに適用するオーバーライドオプション */
  private _playOptions: GesturePlayOptions = {}

  constructor(vrm: VRM) {
    this._vrm = vrm
    this._gestures = gestureDefinitions
  }

  /** Register pre-loaded VRMA poses for a gesture type */
  public registerVrmaPoses(gesture: GestureType, poses: VrmaPose[]) {
    this._vrmaPoses.set(gesture, poses)
  }

  private _isVrmaGesture(): boolean {
    return this._vrmaPoses.has(this._currentGesture)
  }

  public playGesture(gesture: GestureType, options?: GesturePlayOptions) {
    if (gesture === 'none' || this._isPlaying) return

    const definition = this._gestures.get(gesture)
    if (!definition) return

    this._currentGesture = gesture
    this._isPlaying = true
    this._playOptions = options ?? {}

    // VRMAジェスチャーのリセット対象ボーンを記録（全ポーズのボーンを収集）
    const poses = this._vrmaPoses.get(gesture)
    if (poses && poses.length > 0) {
      const boneSet = new Set<VRMHumanBoneName>()
      for (const pose of poses) {
        for (const boneName of pose.keys()) boneSet.add(boneName)
      }
      this._vrmaBonesToReset = Array.from(boneSet)
    }
    this._currentKeyframeIndex = 0
    this._keyframeElapsedTime = 0
    this._isReturning = false
    this._isHolding = false
    this._gestureBlendWeight = 0
    this._currentGestureRotations.clear()
    this._persistedRotations.clear()

    const keyframe = definition.keyframes[0]
    if (keyframe) {
      const identity = new THREE.Quaternion()
      for (const boneRot of keyframe.bones) {
        this._currentGestureRotations.set(boneRot.bone, {
          from: identity.clone(),
          to: boneRot.rotation.clone(),
        })
      }
    }
  }

  /**
   * VRMAジェスチャーが変更した正規化ボーンをslerp前の状態に復元する。
   * mixer.update() の前に呼ぶことで:
   * - mixerトラックがあるボーン → 復元後にmixerが最新値で上書き
   * - トラックがないボーン → slerp前の元の値（初回は元の静止状態）に戻る
   * ジェスチャー終了後も1フレーム分復元を実行し、最終フレームの残存を除去する。
   */
  public resetVrmaBones(): void {
    if (this._preSlerpQuats.size === 0) return

    for (const [boneName, savedQuat] of this._preSlerpQuats) {
      const node = this._vrm.humanoid.getNormalizedBoneNode(boneName)
      if (node) {
        node.quaternion.copy(savedQuat)
      }
    }

    // ジェスチャー終了後、最後の復元を実行したらクリア
    if (!this._isPlaying) {
      this._vrmaBonesToReset = []
      this._preSlerpQuats.clear()
    }
  }

  /**
   * Apply VRMA pose rotations to normalized bone nodes.
   * Must be called AFTER mixer.update() and BEFORE vrm.update().
   *
   * 単一ポーズ: idle ↔ pose のslerp
   * 複数ポーズ: keyframe 0 は idle→pose[0]、以降は pose[i-1]→pose[i] を直接補間
   *            hold/return は idle ↔ 最終ポーズ のslerp
   */
  public applyNormalizedPose(): void {
    if (!this._isPlaying || !this._isVrmaGesture()) return

    const poses = this._vrmaPoses.get(this._currentGesture)
    if (!poses || poses.length === 0) return

    // 現在のターゲットポーズと前のポーズを決定
    const poseIndex = Math.min(this._currentKeyframeIndex, poses.length - 1)
    const targetPose = poses[poseIndex]
    const isIntermediateKeyframe =
      this._currentKeyframeIndex > 0 &&
      !this._isHolding &&
      !this._isReturning &&
      this._currentKeyframeIndex < poses.length
    const prevPose = isIntermediateKeyframe ? poses[poseIndex - 1] : null

    // 全ポーズに含まれるボーン名を収集
    const allBones = new Set<VRMHumanBoneName>()
    for (const pose of poses) {
      for (const boneName of pose.keys()) allBones.add(boneName)
    }

    for (const boneName of allBones) {
      const node = this._vrm.humanoid.getNormalizedBoneNode(boneName)
      if (!node) continue

      // slerp前のクォータニオンを保存（次フレームのresetで復元する）
      this._preSlerpQuats.set(boneName, node.quaternion.clone())

      const targetQuat = targetPose.get(boneName)
      if (!targetQuat) continue

      if (prevPose) {
        // 中間キーフレーム: 前ポーズ→現ポーズを直接補間（mixerの値は無視）
        const prevQuat = prevPose.get(boneName)
        if (prevQuat) {
          node.quaternion
            .copy(prevQuat)
            .slerp(targetQuat, this._gestureBlendWeight)
        } else {
          node.quaternion.slerp(targetQuat, this._gestureBlendWeight)
        }
      } else {
        // 最初のキーフレーム / hold / return: idle↔ターゲットのslerp
        node.quaternion.slerp(targetQuat, this._gestureBlendWeight)
      }
    }
  }

  public update(delta: number, skipEyeClose: boolean = false) {
    if (!this._isPlaying || this._currentGesture === 'none') return

    const definition = this._gestures.get(this._currentGesture)
    if (!definition) return

    const speed = this._playOptions.speed ?? 1
    const scaledDelta = delta * speed

    if (this._isReturning) {
      this._updateReturnAnimation(scaledDelta, skipEyeClose)
    } else if (this._isHolding) {
      this._applyGestureRotations()
    } else {
      this._updateGestureAnimation(scaledDelta, definition)
    }

    if (!skipEyeClose) {
      this._applyGestureExpression()
    }
  }

  private _updateGestureAnimation(
    delta: number,
    definition: GestureDefinition
  ) {
    const keyframe = definition.keyframes[this._currentKeyframeIndex]
    if (!keyframe) {
      this._startHoldPhase(definition)
      return
    }

    this._keyframeElapsedTime += delta
    const progress = Math.min(this._keyframeElapsedTime / keyframe.duration, 1)
    this._gestureBlendWeight = this._easeInOutQuad(progress)

    this._applyGestureRotations()

    if (progress >= 1) {
      this._currentKeyframeIndex++
      this._keyframeElapsedTime = 0

      const nextKeyframe = definition.keyframes[this._currentKeyframeIndex]
      if (nextKeyframe) {
        const nextBones = new Set(nextKeyframe.bones.map((b) => b.bone))
        for (const [bone, rotation] of this._currentGestureRotations) {
          if (!nextBones.has(bone)) {
            this._persistedRotations.set(bone, rotation.to.clone())
          }
        }
        const prevRotations = new Map(this._currentGestureRotations)
        this._currentGestureRotations.clear()
        for (const boneRot of nextKeyframe.bones) {
          const prevRot = prevRotations.get(boneRot.bone)
          const fromQuat = prevRot
            ? prevRot.to.clone()
            : (this._persistedRotations.get(boneRot.bone)?.clone() ??
              new THREE.Quaternion())
          this._currentGestureRotations.set(boneRot.bone, {
            from: fromQuat,
            to: boneRot.rotation.clone(),
          })
        }
        this._gestureBlendWeight = 0
      } else {
        for (const [bone, rotation] of this._currentGestureRotations) {
          this._persistedRotations.set(bone, rotation.to.clone())
        }
        this._currentGestureRotations.clear()
        this._startHoldPhase(definition)
      }
    }
  }

  private _startHoldPhase(definition: GestureDefinition) {
    this._isHolding = true
    this._gestureBlendWeight = 1

    const holdDuration =
      this._playOptions.holdDuration ?? definition.holdDuration

    setTimeout(() => {
      if (this._isPlaying && this._isHolding) {
        this._isHolding = false
        this._startReturnAnimation()
      }
    }, holdDuration * 1000)
  }

  private _startReturnAnimation() {
    this._isReturning = true
    this._keyframeElapsedTime = 0
  }

  private _updateReturnAnimation(delta: number, skipEyeClose: boolean = false) {
    const returnDuration = 0.8
    this._keyframeElapsedTime += delta
    const progress = Math.min(this._keyframeElapsedTime / returnDuration, 1)

    this._gestureBlendWeight = 1 - this._easeInOutQuad(progress)

    this._applyGestureRotations()

    if (progress >= 1) {
      const definition = this._gestures.get(this._currentGesture)
      if (
        definition?.closeEyes &&
        this._vrm.expressionManager &&
        !skipEyeClose
      ) {
        this._vrm.expressionManager.setValue('blink', 0)
      }
      this._gestureJustEnded = true
      this._isPlaying = false
      this._currentGesture = 'none'
      this._isReturning = false
      this._gestureBlendWeight = 0
      this._currentGestureRotations.clear()
      this._persistedRotations.clear()
    }
  }

  private _applyGestureExpression() {
    const definition = this._gestures.get(this._currentGesture)
    if (!definition?.closeEyes) return

    const expressionManager = this._vrm.expressionManager
    if (!expressionManager) return

    const blinkWeight = this._isReturning
      ? this._gestureBlendWeight
      : Math.min(this._gestureBlendWeight * 1.5, 1)

    expressionManager.setValue('blink', blinkWeight)
  }

  private _applyGestureRotations() {
    // Skip raw bone application for VRMA gestures (handled by applyNormalizedPose)
    if (this._isVrmaGesture()) return

    const identity = new THREE.Quaternion()

    const persistedWeight = this._isReturning ? this._gestureBlendWeight : 1
    for (const [boneName, gestureQuat] of this._persistedRotations) {
      const node = this._vrm.humanoid.getRawBoneNode(boneName)
      if (node) {
        const blendedGesture = identity
          .clone()
          .slerp(gestureQuat, persistedWeight)
        node.quaternion.multiply(blendedGesture)
      }
    }

    for (const [boneName, { from, to }] of this._currentGestureRotations) {
      const node = this._vrm.humanoid.getRawBoneNode(boneName)
      if (node) {
        const blendedGesture = from.clone().slerp(to, this._gestureBlendWeight)
        node.quaternion.multiply(blendedGesture)
      }
    }
  }

  private _easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  /** 再生中のジェスチャーを中断してリターンアニメーションに移行する */
  public cancelGesture(): void {
    if (!this._isPlaying) return
    this._isHolding = false
    this._startReturnAnimation()
  }

  public get isPlaying(): boolean {
    return this._isPlaying
  }

  public get currentGesture(): GestureType {
    return this._currentGesture
  }

  /** ジェスチャーが終了した直後かどうか（1回読むとリセットされる） */
  public consumeGestureJustEnded(): boolean {
    if (this._gestureJustEnded) {
      this._gestureJustEnded = false
      return true
    }
    return false
  }

  public get isClosingEyes(): boolean {
    if (!this._isPlaying) return false
    const definition = this._gestures.get(this._currentGesture)
    return definition?.closeEyes === true
  }

  /** VRMAジェスチャーが再生中かどうか */
  public get isPlayingVrmaGesture(): boolean {
    return this._isPlaying && this._isVrmaGesture()
  }
}
