import * as THREE from 'three'
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'

export type GestureType = 'bow' | 'present' | 'none'

interface BoneRotation {
  bone: VRMHumanBoneName
  rotation: THREE.Quaternion // ジェスチャーによる追加回転
}

interface GestureKeyframe {
  duration: number
  bones: BoneRotation[]
}

interface GestureDefinition {
  keyframes: GestureKeyframe[]
  holdDuration: number
  closeEyes?: boolean // ジェスチャー中に目を閉じる
}

/**
 * VRMボーンを操作してジェスチャーを再生するコントローラー
 * アイドルアニメーションの後に呼び出すことで、アイドルの上にジェスチャーを重ねる
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

  // 現在のキーフレームでアニメーション中のボーン回転（from → to）
  private _currentGestureRotations: Map<
    VRMHumanBoneName,
    { from: THREE.Quaternion; to: THREE.Quaternion }
  > = new Map()

  // 前のキーフレームから引き継いだ確定済みボーン回転（常にフル適用）
  private _persistedRotations: Map<VRMHumanBoneName, THREE.Quaternion> =
    new Map()

  // ジェスチャー定義
  private _gestures: Map<GestureType, GestureDefinition> = new Map()

  constructor(vrm: VRM) {
    this._vrm = vrm
    this._initGestures()
  }

  private _initGestures() {
    // お辞儀ジェスチャー（約30度のお辞儀）
    this._gestures.set('bow', {
      keyframes: [
        {
          duration: 1.0,
          bones: [
            {
              bone: 'spine',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.25, 0, 0)
              ),
            },
            {
              bone: 'chest',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.15, 0, 0)
              ),
            },
            {
              bone: 'neck',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.12, 0, 0)
              ),
            },
            {
              bone: 'rightShoulder',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, -0.2, -0.0)
              ),
            },
            {
              bone: 'rightUpperArm',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                  /*上腕の回転*/ 0,
                  /*上腕の前後*/ 0.1,
                  /*上腕の左右*/ -0.1
                )
              ),
            },
            {
              bone: 'rightLowerArm',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.15, 1.5, 0.5)
              ),
            },
            {
              bone: 'rightHand',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.6, 0.2, 0.7)
              ),
            },
            {
              bone: 'leftShoulder',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, 0.2, -0.0)
              ),
            },
            {
              bone: 'leftUpperArm',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                  /*上腕の回転*/ 0,
                  /*上腕の前後*/ -0.1,
                  /*上腕の左右*/ 0.1
                )
              ),
            },
            {
              bone: 'leftLowerArm',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-0.15, -1.5, -0.7)
              ),
            },
            {
              bone: 'leftHand',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.6, -0.2, -0.7)
              ),
            },
          ],
        },
      ],
      holdDuration: 1.0,
      closeEyes: true,
    })

    // 紹介ジェスチャー（手を前に出して示す）
    this._gestures.set('present', {
      keyframes: [
        // 腕を上げる
        {
          duration: 0.6,
          bones: [
            {
              bone: 'neck',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-0.05, -0.2, 0.3)
              ),
            },
            {
              bone: 'chest',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                  /*腰の折りたたみ*/ 0.1,
                  /*腰の回転*/ 0.2,
                  /*腰の左右曲げ*/ -0.15
                )
              ),
            },
            {
              bone: 'rightShoulder',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, -0.0, -0.0)
              ),
            },
            {
              bone: 'rightUpperArm',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.2, -0.3, 0.2)
              ),
            },
            {
              bone: 'rightLowerArm',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(1.7, 0.5, -2.9)
              ),
            },
            {
              bone: 'rightHand',
              rotation: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, -0.5, -0.6)
              ),
            },
          ],
        },
      ],
      holdDuration: 2.0,
    })
  }

  /**
   * ジェスチャーを再生
   */
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

    // 最初のキーフレームのジェスチャー回転を設定
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
   * フレーム更新（VRM.update()の後に呼び出すこと）
   */
  public update(delta: number) {
    if (!this._isPlaying || this._currentGesture === 'none') return

    const definition = this._gestures.get(this._currentGesture)
    if (!definition) return

    if (this._isReturning) {
      this._updateReturnAnimation(delta)
    } else if (this._isHolding) {
      // ホールド中は最大ブレンドで維持
      this._applyGestureRotations()
    } else {
      this._updateGestureAnimation(delta, definition)
    }

    // ジェスチャー中の表情を適用
    this._applyGestureExpression()
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

    // ジェスチャー回転を適用
    this._applyGestureRotations()

    // キーフレーム完了チェック
    if (progress >= 1) {
      this._currentKeyframeIndex++
      this._keyframeElapsedTime = 0

      // 次のキーフレームがあれば準備
      const nextKeyframe = definition.keyframes[this._currentKeyframeIndex]
      if (nextKeyframe) {
        // 現在のアニメーション中のボーン回転を確定済みに移動（次のキーフレームにないボーンのみ）
        const nextBones = new Set(nextKeyframe.bones.map((b) => b.bone))
        for (const [bone, rotation] of this._currentGestureRotations) {
          if (!nextBones.has(bone)) {
            this._persistedRotations.set(bone, rotation.to.clone())
          }
        }
        // 次のキーフレームのボーンをアニメーション対象に設定
        const prevRotations = new Map(this._currentGestureRotations)
        this._currentGestureRotations.clear()
        for (const boneRot of nextKeyframe.bones) {
          // 前のキーフレームにあったボーンは、その終了値から開始
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
        this._gestureBlendWeight = 0 // 新しいアニメーション開始
      } else {
        // 最後のキーフレームのボーン回転も確定済みに移動
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

    // ホールド後に戻りアニメーションを開始
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

  private _updateReturnAnimation(delta: number) {
    const returnDuration = 0.8
    this._keyframeElapsedTime += delta
    const progress = Math.min(this._keyframeElapsedTime / returnDuration, 1)

    // 戻りアニメーション中はジェスチャーの影響を減らしていく
    this._gestureBlendWeight = 1 - this._easeInOutQuad(progress)

    this._applyGestureRotations()

    if (progress >= 1) {
      // 目を閉じていた場合は開ける
      const definition = this._gestures.get(this._currentGesture)
      if (definition?.closeEyes && this._vrm.expressionManager) {
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

  /**
   * ジェスチャー中の表情を適用（目を閉じるなど）
   */
  private _applyGestureExpression() {
    const definition = this._gestures.get(this._currentGesture)
    if (!definition?.closeEyes) return

    const expressionManager = this._vrm.expressionManager
    if (!expressionManager) return

    // ジェスチャーの進行に合わせて目を閉じる
    // 戻りアニメーション中は徐々に開ける
    const blinkWeight = this._isReturning
      ? this._gestureBlendWeight
      : Math.min(this._gestureBlendWeight * 1.5, 1) // 素早く閉じる

    expressionManager.setValue('blink', blinkWeight)
  }

  /**
   * ジェスチャー回転を現在のアイドルアニメーションの上に適用
   */
  private _applyGestureRotations() {
    const identity = new THREE.Quaternion()

    // 確定済みのボーン回転を適用（常にフルウェイト、戻り時はブレンド）
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

    // アニメーション中のボーン回転を適用（from → to を補間）
    for (const [boneName, { from, to }] of this._currentGestureRotations) {
      const node = this._vrm.humanoid.getRawBoneNode(boneName)
      if (node) {
        // from から to へ補間した回転を計算
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

  /**
   * ジェスチャーにより目を閉じている状態かどうか
   */
  public get isClosingEyes(): boolean {
    if (!this._isPlaying) return false
    const definition = this._gestures.get(this._currentGesture)
    return definition?.closeEyes === true
  }
}
