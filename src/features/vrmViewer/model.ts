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
import { loadVRMAnimation } from '@/lib/VRMAnimation/loadVRMAnimation'
import { EmoteController } from '../emoteController/emoteController'
import { GestureType } from '../emoteController/gestures'
import { GesturePlayOptions } from '../emoteController/gestureController'
import { Talk } from '../messages/messages'
import { LipSync } from '../lipSync/lipSync'
import { buildUrl } from '@/utils/buildUrl'

/**
 * 3Dキャラクターを管理するクラス
 */
export class Model {
  public vrm?: VRM | null
  public mixer?: THREE.AnimationMixer
  public emoteController?: EmoteController

  private _lookAtTargetParent: THREE.Object3D
  private _lipSync?: LipSync
  private _idleAction?: THREE.AnimationAction
  private _gestureAction?: THREE.AnimationAction
  private _gestureHipsOrigin?: THREE.Vector3
  /** ボーンスナップショット遷移用 */
  private _blendSnapshot?: Map<string, THREE.Quaternion>
  private _blendElapsed = 0
  private _blendDuration = 0
  private readonly _tempQ = new THREE.Quaternion()

  constructor(lookAtTargetParent: THREE.Object3D) {
    this._lookAtTargetParent = lookAtTargetParent
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

    // VectorKeyframeTrack → QuaternionKeyframeTrack に変換
    // （PropertyMixerがslerp補間になり、クロスフェード時のブレンドが正しくなる）
    clip.tracks = clip.tracks.map((track) => {
      if (track.name.endsWith('.quaternion')) {
        return new THREE.QuaternionKeyframeTrack(
          track.name,
          Array.from(track.times),
          Array.from(track.values)
        )
      }
      return track
    })

    const action = mixer.clipAction(clip)
    action.play()
    this._idleAction = action
  }

  /**
   * VRMAアニメーションをフル再生する（アイドルと切り替え）
   */
  public async playVrmaAnimation(url: string): Promise<void> {
    const { vrm, mixer } = this
    if (!vrm || !mixer) return

    // 再生中のジェスチャーアニメーションがあれば停止
    if (this._gestureAction) {
      this._gestureAction.stop()
      mixer.uncacheAction(this._gestureAction.getClip())
      this._gestureAction = undefined
    }

    const vrmAnimation = await loadVRMAnimation(buildUrl(url))
    if (!vrmAnimation) return

    // 位置ズレ防止: translation トラックをクリアしてからクリップ生成
    vrmAnimation.humanoidTracks.translation.clear()

    const clip = vrmAnimation.createAnimationClip(vrm)

    // 腕のブレ防止: VectorKeyframeTrack → QuaternionKeyframeTrack に変換
    // （線形補間→slerp補間になり、回転がスムーズになる）
    clip.tracks = clip.tracks.map((track) => {
      if (track.name.endsWith('.quaternion')) {
        return new THREE.QuaternionKeyframeTrack(
          track.name,
          Array.from(track.times),
          Array.from(track.values)
        )
      }
      return track
    })

    // ヒップ位置を記録（ドリフト補正の基準点）
    const hipsBone = vrm.humanoid.getNormalizedBoneNode('hips')
    if (hipsBone) {
      const boneWorld = new THREE.Vector3()
      const sceneWorld = new THREE.Vector3()
      hipsBone.getWorldPosition(boneWorld)
      vrm.scene.getWorldPosition(sceneWorld)
      this._gestureHipsOrigin = boneWorld.sub(sceneWorld)
    }

    // 現在のボーン状態をスナップショットしてブレンド遷移開始
    this._startBlend(0.3)

    // アイドルを停止してジェスチャーを再生
    if (this._idleAction) {
      this._idleAction.stop()
    }

    const action = mixer.clipAction(clip)
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = false
    action.reset().play()
    this._gestureAction = action

    // アニメーション終了時にアイドルに戻す
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === action) {
        mixer.removeEventListener('finished', onFinished)

        // アイドル復帰時もスナップショットブレンド
        this._startBlend(0.3)

        action.stop()
        mixer.uncacheAction(clip)
        this._gestureAction = undefined
        this._gestureHipsOrigin = undefined
        vrm.scene.position.set(0, 0, 0)

        if (this._idleAction) {
          this._idleAction.reset().play()
        }
      }
    }
    mixer.addEventListener('finished', onFinished)
  }

  /**
   * LipSyncインスタンスを遅延初期化する
   */
  public initLipSync(): void {
    if (this._lipSync) return
    const audioContext = new AudioContext()
    this._lipSync = new LipSync(audioContext)
  }

  /**
   * 音声を再生し、リップシンクを行う
   */
  public async speak(
    buffer: ArrayBuffer,
    talk: Talk,
    isNeedDecode: boolean = true
  ): Promise<void> {
    this.emoteController?.playEmotion(talk.emotion)

    if (!this._lipSync) {
      return
    }

    return new Promise((resolve) => {
      this._lipSync!.playFromArrayBuffer(
        buffer,
        () => {
          // 再生完了時に口を閉じる
          this.emoteController?.lipSync('aa', 0)
          resolve()
        },
        isNeedDecode,
        16000
      )
    })
  }

  /**
   * 現在の音声再生を停止
   */
  public stopSpeaking() {
    this._lipSync?.stopCurrentPlayback()
    this.emoteController?.lipSync('aa', 0)
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
  public playGesture(gesture: GestureType, options?: GesturePlayOptions) {
    this.emoteController?.playGesture(gesture, options)
  }

  public cancelGesture(): void {
    this.emoteController?.cancelGesture()
  }

  public enterDrowsy(): void {
    this.emoteController?.enterDrowsy()
  }

  public wakeUp(): void {
    this.emoteController?.wakeUp()
  }

  public get isSleeping(): boolean {
    return this.emoteController?.isSleeping ?? false
  }

  /** ブレンド遷移を開始する（現在のボーン状態を記録） */
  private _startBlend(duration: number): void {
    if (!this.vrm) return
    const snapshot = new Map<string, THREE.Quaternion>()
    const humanoid = this.vrm.humanoid
    const boneNames = [
      'hips',
      'spine',
      'chest',
      'upperChest',
      'neck',
      'head',
      'leftShoulder',
      'leftUpperArm',
      'leftLowerArm',
      'leftHand',
      'rightShoulder',
      'rightUpperArm',
      'rightLowerArm',
      'rightHand',
      'leftUpperLeg',
      'leftLowerLeg',
      'leftFoot',
      'rightUpperLeg',
      'rightLowerLeg',
      'rightFoot',
    ] as const
    for (const name of boneNames) {
      const node = humanoid.getNormalizedBoneNode(name)
      if (node) {
        snapshot.set(node.name, node.quaternion.clone())
      }
    }
    this._blendSnapshot = snapshot
    this._blendElapsed = 0
    this._blendDuration = duration
  }

  /** Load VRMA pose files for gestures that use them */
  public async loadGestureAnimations(): Promise<void> {
    await this.emoteController?.loadVrmaPoses()
  }

  public update(delta: number): void {
    // 音声リップシンク：音量に応じて口の開閉を駆動
    if (this._lipSync) {
      const { volume } = this._lipSync.update()
      this.emoteController?.lipSync('aa', volume)
    }

    // 表情・瞬きの更新（ジェスチャー以外）
    this.emoteController?.updateExpression(delta)

    // VRMAジェスチャー対象ボーンをidentityにリセット（mixer前に実行し、
    // mixerトラックがあるボーンはmixerが上書き、ないボーンはidentityに戻る）
    this.emoteController?.resetNormalizedBones()

    // アイドルアニメーションの更新
    this.mixer?.update(delta)

    // スナップショットブレンド: mixerが設定したボーン回転をスナップショットからslerpで遷移
    if (this._blendSnapshot && this._blendDuration > 0) {
      this._blendElapsed += delta
      const t = Math.min(this._blendElapsed / this._blendDuration, 1)
      // smoothstep でイーズイン・イーズアウト
      const s = t * t * (3 - 2 * t)
      for (const [nodeName, snapQ] of this._blendSnapshot) {
        const node = this.vrm?.scene.getObjectByName(nodeName)
        if (node) {
          // mixerが設定した値を退避してからslerp（同一オブジェクト問題を回避）
          this._tempQ.copy(node.quaternion)
          node.quaternion.slerpQuaternions(snapQ, this._tempQ, s)
        }
      }
      if (t >= 1) {
        this._blendSnapshot = undefined
      }
    }

    // VRMAジェスチャーの適用（正規化ボーンへのslerp、VRM更新の前に実行）
    this.emoteController?.applyNormalizedGesture()

    // VRMの内部更新（look-at、スプリングボーン等、正規化→rawボーン変換含む）
    this.vrm?.update(delta)

    // VRMAフルアニメーション再生中のドリフト補正
    // ヒップボーンのシーン相対位置を基準点と比較し、シーン全体を逆方向にオフセット
    if (this._gestureHipsOrigin && this.vrm) {
      const hipsBone = this.vrm.humanoid.getNormalizedBoneNode('hips')
      if (hipsBone) {
        const boneWorld = new THREE.Vector3()
        const sceneWorld = new THREE.Vector3()
        hipsBone.getWorldPosition(boneWorld)
        this.vrm.scene.getWorldPosition(sceneWorld)
        const current = boneWorld.sub(sceneWorld)
        this.vrm.scene.position.x = -(current.x - this._gestureHipsOrigin.x)
        this.vrm.scene.position.z = -(current.z - this._gestureHipsOrigin.z)
      }
    }

    // Eulerベースジェスチャーの更新（rawボーンへのmultiply、VRM更新の後に実行）
    this.emoteController?.updateGesture(delta)
  }
}
