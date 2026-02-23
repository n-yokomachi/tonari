import * as THREE from 'three'
import {
  VRM,
  VRMExpressionPresetName,
  VRMLoaderPlugin,
  VRMUtils,
} from '@pixiv/three-vrm'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMAnimation } from '../../lib/VRMAnimation/VRMAnimation'
import { VRMLookAtSmootherLoaderPlugin } from '@/lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin'
import { EmoteController } from '../emoteController/emoteController'
import { GestureType } from '../emoteController/gestures'
import { Talk } from '../messages/messages'

/**
 * 3Dキャラクターを管理するクラス
 */
export class Model {
  public vrm?: VRM | null
  public mixer?: THREE.AnimationMixer
  public emoteController?: EmoteController

  private _lookAtTargetParent: THREE.Object3D

  constructor(lookAtTargetParent: THREE.Object3D) {
    this._lookAtTargetParent = lookAtTargetParent
    // Tonariでは音声出力機能を削除しているため、LipSyncは作成しない
  }

  public async loadVRM(url: string): Promise<void> {
    const loader = new GLTFLoader()
    loader.register(
      (parser) =>
        new VRMLoaderPlugin(parser, {
          lookAtPlugin: new VRMLookAtSmootherLoaderPlugin(parser),
        })
    )

    const gltf = await loader.loadAsync(url)

    const vrm = (this.vrm = gltf.userData.vrm)
    vrm.scene.name = 'VRMRoot'

    VRMUtils.rotateVRM0(vrm)
    this.mixer = new THREE.AnimationMixer(vrm.scene)

    this.emoteController = new EmoteController(vrm, this._lookAtTargetParent)
  }

  public unLoadVrm() {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene)
      this.vrm = null
    }
  }

  /**
   * VRMアニメーションを読み込む
   *
   * https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm_animation-1.0/README.ja.md
   */
  public async loadAnimation(vrmAnimation: VRMAnimation): Promise<void> {
    const { vrm, mixer } = this
    if (vrm == null || mixer == null) {
      throw new Error('You have to load VRM first')
    }

    const clip = vrmAnimation.createAnimationClip(vrm)
    const action = mixer.clipAction(clip)
    action.play()
  }

  /**
   * 音声を再生し、リップシンクを行う
   * Tonariでは音声出力機能を削除しているため、表情のみ設定
   */
  public async speak(
    buffer: ArrayBuffer,
    talk: Talk,
    isNeedDecode: boolean = true
  ) {
    this.emoteController?.playEmotion(talk.emotion)
    // 音声再生なしのため即座に完了
  }

  /**
   * 現在の音声再生を停止
   */
  public stopSpeaking() {
    // Tonariでは音声出力機能を削除しているため、何もしない
  }

  /**
   * 感情表現を再生する
   */
  public async playEmotion(preset: VRMExpressionPresetName) {
    this.emoteController?.playEmotion(preset)
  }

  /**
   * ジェスチャーを再生する
   */
  public playGesture(gesture: GestureType) {
    this.emoteController?.playGesture(gesture)
  }

  /** Load VRMA pose files for gestures that use them */
  public async loadGestureAnimations(): Promise<void> {
    await this.emoteController?.loadVrmaPoses()
  }

  public update(delta: number): void {
    // Tonariでは音声出力機能を削除しているため、リップシンク処理はスキップ

    // 表情・瞬きの更新（ジェスチャー以外）
    this.emoteController?.updateExpression(delta)

    // アイドルアニメーションの更新
    this.mixer?.update(delta)

    // VRMAジェスチャーの適用（正規化ボーンへのslerp、VRM更新の前に実行）
    this.emoteController?.applyNormalizedGesture()

    // VRMの内部更新（look-at、スプリングボーン等、正規化→rawボーン変換含む）
    this.vrm?.update(delta)

    // Eulerベースジェスチャーの更新（rawボーンへのmultiply、VRM更新の後に実行）
    this.emoteController?.updateGesture(delta)
  }
}
