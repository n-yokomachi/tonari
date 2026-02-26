import * as THREE from 'three'
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm'
import { VRMLookAtSmoother } from '@/lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmoother'
import { ExpressionController } from './expressionController'
import {
  GestureController,
  GestureType,
  GesturePlayOptions,
} from './gestureController'
import {
  GestureType as GType,
  VrmaPose,
  gestureDefinitions,
  loadVrmaPose,
} from './gestures'
import { SleepController } from './sleepController'
import { buildUrl } from '@/utils/buildUrl'

/**
 * 感情表現としてExpressionとMotionを操作する為のクラス
 */
export class EmoteController {
  private _expressionController: ExpressionController
  private _gestureController: GestureController
  private _sleepController?: SleepController
  private _vrm: VRM

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._vrm = vrm
    this._expressionController = new ExpressionController(vrm, camera)
    this._gestureController = new GestureController(vrm)
    if (vrm.expressionManager) {
      this._sleepController = new SleepController(
        vrm.expressionManager,
        vrm.humanoid
      )
    }
  }

  /** Load all VRMA pose files referenced by gesture definitions */
  public async loadVrmaPoses(): Promise<void> {
    for (const [gestureType, definition] of gestureDefinitions) {
      const urls = definition.vrmaUrls
        ? definition.vrmaUrls
        : definition.vrmaUrl
          ? [definition.vrmaUrl]
          : null
      if (!urls) continue

      try {
        const poses = await Promise.all(
          urls.map((url) => loadVrmaPose(buildUrl(url), this._vrm))
        )
        this._gestureController.registerVrmaPoses(gestureType as GType, poses)
      } catch (e) {
        console.warn(`Failed to load VRMA poses for ${gestureType}:`, e)
      }
    }
  }

  public playEmotion(preset: VRMExpressionPresetName) {
    this._expressionController.playEmotion(preset)
  }

  public playGesture(gesture: GestureType, options?: GesturePlayOptions) {
    this._gestureController.playGesture(gesture, options)
  }

  public cancelGesture(): void {
    this._gestureController.cancelGesture()
  }

  public enterDrowsy(): void {
    this._expressionController.setAutoBlinkEnable(false)
    this._sleepController?.enterDrowsy()
  }

  public wakeUp(): void {
    this._sleepController?.wakeUp()
  }

  public get isSleeping(): boolean {
    return this._sleepController?.isSleeping ?? false
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
    const sleeping = this._sleepController?.phase !== 'awake'

    if (sleeping) {
      // 睡眠中はautoBlink・感情表現をスキップし、sleepControllerが目を制御
      this._sleepController!.update(delta)
      // waking完了後にautoBlink復帰
      if (this._sleepController!.phase === 'awake') {
        this._expressionController.setAutoBlinkEnable(true)
      }
    } else {
      const isEmotionActive = this._expressionController.isEmotionActive
      const skipAutoBlink =
        this._gestureController.isClosingEyes && !isEmotionActive
      this._expressionController.update(delta, skipAutoBlink)
    }
  }

  /**
   * VRMAジェスチャーが変更したボーンをslerp前の状態に復元する。
   * mixer.update() の前に呼ぶ。
   */
  public resetNormalizedBones(): void {
    this._gestureController.resetVrmaBones()
  }

  /**
   * Apply VRMA gesture rotations to normalized bones.
   * Must be called BEFORE vrm.update().
   */
  public applyNormalizedGesture(): void {
    this._gestureController.applyNormalizedPose()
  }

  /** VRMAジェスチャーが再生中かどうか */
  public get isPlayingVrmaGesture(): boolean {
    return this._gestureController.isPlayingVrmaGesture
  }

  public updateGesture(delta: number) {
    const isEmotionActive = this._expressionController.isEmotionActive
    this._gestureController.update(delta, isEmotionActive)

    // ジェスチャー終了時にlookAtのスムージング値をリセットし、首の角度ずれを防ぐ
    if (this._gestureController.consumeGestureJustEnded()) {
      const lookAt = this._vrm.lookAt
      if (lookAt instanceof VRMLookAtSmoother) {
        lookAt.resetDamping()
      }
    }

    // 睡眠時の首の前傾（rawボーンへのmultiply、vrm.update後に適用）
    this._sleepController?.applyNeckTilt()
  }
}
