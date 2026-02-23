import * as THREE from 'three'
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import {
  GestureType,
  GestureDefinition,
  gestureDefinitions,
  VrmaPose,
} from './gestures'

export type { GestureType }

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

  private _currentGestureRotations: Map<
    VRMHumanBoneName,
    { from: THREE.Quaternion; to: THREE.Quaternion }
  > = new Map()

  private _persistedRotations: Map<VRMHumanBoneName, THREE.Quaternion> =
    new Map()

  private _gestures: ReadonlyMap<GestureType, GestureDefinition>

  /** Pre-loaded VRMA pose data (normalized bone rotations) */
  private _vrmaPoses: Map<GestureType, VrmaPose> = new Map()

  constructor(vrm: VRM) {
    this._vrm = vrm
    this._gestures = gestureDefinitions
  }

  /** Register a pre-loaded VRMA pose for a gesture type */
  public registerVrmaPose(gesture: GestureType, pose: VrmaPose) {
    this._vrmaPoses.set(gesture, pose)
  }

  private _isVrmaGesture(): boolean {
    return this._vrmaPoses.has(this._currentGesture)
  }

  public playGesture(gesture: GestureType) {
    if (gesture === 'none' || this._isPlaying) return

    const definition = this._gestures.get(gesture)
    if (!definition) return

    this._currentGesture = gesture
    this._isPlaying = true
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
   * Apply VRMA pose rotations to normalized bone nodes.
   * Must be called BEFORE vrm.update() so the VRM pipeline transforms
   * normalized bones to raw bones correctly.
   */
  public applyNormalizedPose(): void {
    if (!this._isPlaying || !this._isVrmaGesture()) return

    const pose = this._vrmaPoses.get(this._currentGesture)
    if (!pose) return

    for (const [boneName, targetQuat] of pose) {
      const node = this._vrm.humanoid.getNormalizedBoneNode(boneName)
      if (node) {
        // Slerp from current idle rotation to the target pose
        node.quaternion.slerp(targetQuat, this._gestureBlendWeight)
      }
    }
  }

  public update(delta: number, skipEyeClose: boolean = false) {
    if (!this._isPlaying || this._currentGesture === 'none') return

    const definition = this._gestures.get(this._currentGesture)
    if (!definition) return

    if (this._isReturning) {
      this._updateReturnAnimation(delta, skipEyeClose)
    } else if (this._isHolding) {
      this._applyGestureRotations()
    } else {
      this._updateGestureAnimation(delta, definition)
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

    setTimeout(() => {
      if (this._isPlaying && this._isHolding) {
        this._isHolding = false
        this._startReturnAnimation()
      }
    }, definition.holdDuration * 1000)
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

  public get isPlaying(): boolean {
    return this._isPlaying
  }

  public get currentGesture(): GestureType {
    return this._currentGesture
  }

  public get isClosingEyes(): boolean {
    if (!this._isPlaying) return false
    const definition = this._gestures.get(this._currentGesture)
    return definition?.closeEyes === true
  }
}
