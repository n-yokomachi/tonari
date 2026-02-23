import * as THREE from 'three'
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm'
import { ExpressionController } from './expressionController'
import { GestureController, GestureType } from './gestureController'
import {
  GestureType as GType,
  VrmaPose,
  gestureDefinitions,
  loadVrmaPose,
} from './gestures'
import { buildUrl } from '@/utils/buildUrl'

/**
 * 感情表現としてExpressionとMotionを操作する為のクラス
 */
export class EmoteController {
  private _expressionController: ExpressionController
  private _gestureController: GestureController
  private _vrm: VRM

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._vrm = vrm
    this._expressionController = new ExpressionController(vrm, camera)
    this._gestureController = new GestureController(vrm)
  }

  /** Load all VRMA pose files referenced by gesture definitions */
  public async loadVrmaPoses(): Promise<void> {
    for (const [gestureType, definition] of gestureDefinitions) {
      if (definition.vrmaUrl) {
        try {
          const pose = await loadVrmaPose(
            buildUrl(definition.vrmaUrl),
            this._vrm
          )
          this._gestureController.registerVrmaPose(gestureType as GType, pose)
        } catch (e) {
          console.warn(`Failed to load VRMA pose for ${gestureType}:`, e)
        }
      }
    }
  }

  public playEmotion(preset: VRMExpressionPresetName) {
    this._expressionController.playEmotion(preset)
  }

  public playGesture(gesture: GestureType) {
    this._gestureController.playGesture(gesture)
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    this._expressionController.lipSync(preset, value)
  }

  public update(delta: number) {
    // ジェスチャーで目を閉じている間は瞬きをスキップ
    // ただし感情表現中は目を閉じないのでスキップ不要
    const isEmotionActive = this._expressionController.isEmotionActive
    const skipAutoBlink =
      this._gestureController.isClosingEyes && !isEmotionActive
    this._expressionController.update(delta, skipAutoBlink)
    // 感情表現中はジェスチャーの目閉じをスキップ
    this._gestureController.update(delta, isEmotionActive)
  }

  public updateExpression(delta: number) {
    const isEmotionActive = this._expressionController.isEmotionActive
    const skipAutoBlink =
      this._gestureController.isClosingEyes && !isEmotionActive
    this._expressionController.update(delta, skipAutoBlink)
  }

  /**
   * Apply VRMA gesture rotations to normalized bones.
   * Must be called BEFORE vrm.update().
   */
  public applyNormalizedGesture(): void {
    this._gestureController.applyNormalizedPose()
  }

  public updateGesture(delta: number) {
    const isEmotionActive = this._expressionController.isEmotionActive
    this._gestureController.update(delta, isEmotionActive)
  }
}
