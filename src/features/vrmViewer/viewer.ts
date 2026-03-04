import * as THREE from 'three'
import { Model } from './model'
import { loadVRMAnimation } from '@/lib/VRMAnimation/loadVRMAnimation'
import { buildUrl } from '@/utils/buildUrl'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import settingsStore from '@/features/stores/settings'

/**
 * three.jsを使った3Dビューワー
 *
 * setup()でcanvasを渡してから使う
 */
export type EntranceAnimationType =
  | 'softRise'
  | 'dissolve'
  | 'particle'
  | 'glitch'
  | 'bloom'

export class Viewer {
  public isReady: boolean
  public model?: Model

  private _renderer?: THREE.WebGLRenderer
  private _clock: THREE.Clock
  private _scene: THREE.Scene
  private _camera?: THREE.PerspectiveCamera
  private _cameraControls?: OrbitControls
  private _directionalLight?: THREE.DirectionalLight
  private _ambientLight?: THREE.AmbientLight
  private _entranceRafId?: number
  private _particleSystem?: THREE.Points

  constructor() {
    this.isReady = false

    // scene
    const scene = new THREE.Scene()
    this._scene = scene

    // light
    const lightingIntensity = settingsStore.getState().lightingIntensity
    this._directionalLight = new THREE.DirectionalLight(
      0xffffff,
      1.8 * lightingIntensity
    )
    this._directionalLight.position.set(1.0, 1.0, 1.0).normalize()
    scene.add(this._directionalLight)

    this._ambientLight = new THREE.AmbientLight(
      0xffffff,
      1.2 * lightingIntensity
    )
    scene.add(this._ambientLight)

    // animate
    this._clock = new THREE.Clock()
    this._clock.start()
  }

  public loadVrm(url: string) {
    if (this.model?.vrm) {
      this.unloadVRM()
    }

    // gltf and vrm
    this.model = new Model(this._camera || new THREE.Object3D())
    this.model.loadVRM(url).then(async () => {
      if (!this.model?.vrm) return

      // 初期化完了まで非表示にする（ぶれ防止）
      this.model.vrm.scene.visible = false

      // Disable frustum culling
      this.model.vrm.scene.traverse((obj) => {
        obj.frustumCulled = false
      })

      this._scene.add(this.model.vrm.scene)

      const vrma = await loadVRMAnimation(buildUrl('/idle_loop.vrma'))
      if (vrma) this.model.loadAnimation(vrma)

      // Load VRMA gesture poses
      await this.model.loadGestureAnimations()

      // HACK: アニメーションの原点がずれているので再生後にカメラ位置を調整する
      requestAnimationFrame(() => {
        this.resetCamera()

        // スプリングボーン等の物理シミュレーションが安定するまで数フレーム待つ
        let frameCount = 0
        const waitForStabilization = () => {
          frameCount++
          if (frameCount >= 5) {
            if (this.model?.vrm) {
              this.model.vrm.scene.visible = true
              const canvas = this._renderer?.domElement
              if (canvas) {
                this.playEntranceAnimation(canvas, 'softRise')
              }
            }
          } else {
            requestAnimationFrame(waitForStabilization)
          }
        }
        requestAnimationFrame(waitForStabilization)
      })
    })
  }

  public unloadVRM(): void {
    if (this.model?.vrm) {
      this._scene.remove(this.model.vrm.scene)
      this.model?.unLoadVrm()
    }
    this.resetCanvasStyle()
  }

  private resetCanvasStyle() {
    const canvas = this._renderer?.domElement
    if (!canvas) return
    canvas.style.transition = 'none'
    canvas.style.opacity = '0'
    canvas.style.filter = ''
    canvas.style.transform = ''
    canvas.style.clipPath = ''
  }

  /**
   * 登場アニメーションを再生する
   */
  public playEntranceAnimation(
    canvas?: HTMLCanvasElement,
    type: EntranceAnimationType = 'softRise'
  ) {
    const target = canvas || this._renderer?.domElement
    if (!target) return

    this._cleanupEntrance()

    switch (type) {
      case 'softRise':
        this._animSoftRise(target)
        break
      case 'dissolve':
        this._animDissolve(target)
        break
      case 'particle':
        this._animParticle(target)
        break
      case 'glitch':
        this._animGlitch(target)
        break
      case 'bloom':
        this._animBloom(target)
        break
    }
  }

  private _cleanupEntrance() {
    if (this._entranceRafId) {
      cancelAnimationFrame(this._entranceRafId)
      this._entranceRafId = undefined
    }
    if (this._particleSystem) {
      this._scene.remove(this._particleSystem)
      this._particleSystem.geometry.dispose()
      ;(this._particleSystem.material as THREE.Material).dispose()
      this._particleSystem = undefined
    }
    // Reset VRM material opacity
    this.model?.vrm?.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.Material
        mat.opacity = 1
        mat.transparent = false
      }
    })
    // Reset canvas styles
    const canvas = this._renderer?.domElement
    if (canvas) {
      canvas.style.transition = 'none'
      canvas.style.filter = ''
      canvas.style.transform = ''
      canvas.style.clipPath = ''
      canvas.style.opacity = '1'
      canvas.style.animation = ''
    }
    // Reset light
    if (this._directionalLight) {
      const intensity = settingsStore.getState().lightingIntensity
      this._directionalLight.intensity = 1.8 * intensity
      this._directionalLight.color.setHex(0xffffff)
    }
  }

  // --- 1. Soft Rise (original) ---
  private _animSoftRise(canvas: HTMLCanvasElement) {
    canvas.style.transition = 'none'
    canvas.style.opacity = '0'
    canvas.style.transform = 'translateY(20px)'
    canvas.style.filter = 'blur(6px)'
    void canvas.offsetHeight
    canvas.style.transition =
      'opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s ease-out'
    requestAnimationFrame(() => {
      canvas.style.opacity = '1'
      canvas.style.transform = 'translateY(0)'
      canvas.style.filter = 'blur(0px)'
    })
  }

  // --- 2. Dissolve (material opacity) ---
  private _animDissolve(canvas: HTMLCanvasElement) {
    canvas.style.opacity = '1'
    const meshes: THREE.Mesh[] = []
    this.model?.vrm?.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.Material
        mat.transparent = true
        mat.opacity = 0
        meshes.push(mesh)
      }
    })

    const duration = 1500
    const start = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      meshes.forEach((mesh) => {
        ;(mesh.material as THREE.Material).opacity = eased
      })
      if (t < 1) {
        this._entranceRafId = requestAnimationFrame(animate)
      } else {
        meshes.forEach((mesh) => {
          const mat = mesh.material as THREE.Material
          mat.opacity = 1
          mat.transparent = false
        })
      }
    }
    this._entranceRafId = requestAnimationFrame(animate)
  }

  // --- 3. Particle burst + fade in ---
  private _animParticle(canvas: HTMLCanvasElement) {
    canvas.style.opacity = '1'
    // Hide VRM initially
    const meshes: THREE.Mesh[] = []
    this.model?.vrm?.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.Material
        mat.transparent = true
        mat.opacity = 0
        meshes.push(mesh)
      }
    })

    // Create particles around the model
    const count = 200
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 1.2
      positions[i3 + 1] = Math.random() * 2.0
      positions[i3 + 2] = (Math.random() - 0.5) * 1.2
      velocities[i3] = (Math.random() - 0.5) * 0.02
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.02,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this._particleSystem = new THREE.Points(geometry, material)
    this._scene.add(this._particleSystem)

    const duration = 2000
    const start = performance.now()

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)

      // Move particles
      const posAttr = geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        posAttr.array[i3] += velocities[i3]
        posAttr.array[i3 + 1] += velocities[i3 + 1]
        posAttr.array[i3 + 2] += velocities[i3 + 2]
      }
      posAttr.needsUpdate = true

      // Fade particles out, model in
      material.opacity = 1 - t
      const modelOpacity = Math.max(0, (t - 0.3) / 0.7) // start at 30%
      const eased = 1 - Math.pow(1 - modelOpacity, 2)
      meshes.forEach((mesh) => {
        ;(mesh.material as THREE.Material).opacity = eased
      })

      if (t < 1) {
        this._entranceRafId = requestAnimationFrame(animate)
      } else {
        // Cleanup particles
        this._scene.remove(this._particleSystem!)
        geometry.dispose()
        material.dispose()
        this._particleSystem = undefined
        meshes.forEach((mesh) => {
          const mat = mesh.material as THREE.Material
          mat.opacity = 1
          mat.transparent = false
        })
      }
    }
    this._entranceRafId = requestAnimationFrame(animate)
  }

  // --- 4. Digital glitch + scanline ---
  private _animGlitch(canvas: HTMLCanvasElement) {
    canvas.style.opacity = '0'
    void canvas.offsetHeight

    // Inject keyframes if not already present
    if (!document.getElementById('glitch-entrance-style')) {
      const style = document.createElement('style')
      style.id = 'glitch-entrance-style'
      style.textContent = `
        @keyframes glitch-entrance {
          0% { opacity: 0; clip-path: inset(0 100% 0 0); filter: hue-rotate(0deg) brightness(1); }
          10% { opacity: 1; clip-path: inset(0 60% 0 0); filter: hue-rotate(90deg) brightness(1.3); }
          15% { clip-path: inset(30% 0 40% 0); filter: hue-rotate(0deg) brightness(1); }
          20% { clip-path: inset(0 20% 0 30%); filter: hue-rotate(180deg) brightness(1.2); }
          25% { clip-path: inset(60% 0 10% 0); filter: hue-rotate(0deg) brightness(1); }
          35% { clip-path: inset(0 10% 0 0); filter: hue-rotate(45deg) brightness(1.1); }
          45% { clip-path: inset(0 0 0 0); filter: hue-rotate(0deg) brightness(1); }
          50% { clip-path: inset(20% 0 50% 0); filter: hue-rotate(270deg) brightness(1.2); }
          55% { clip-path: inset(0 0 0 0); filter: hue-rotate(0deg) brightness(1); }
          100% { opacity: 1; clip-path: inset(0 0 0 0); filter: hue-rotate(0deg) brightness(1); }
        }
      `
      document.head.appendChild(style)
    }

    canvas.style.animation = 'glitch-entrance 1.2s ease-out forwards'
    canvas.addEventListener(
      'animationend',
      () => {
        canvas.style.animation = ''
        canvas.style.opacity = '1'
        canvas.style.filter = ''
        canvas.style.clipPath = ''
      },
      { once: true }
    )
  }

  // --- 5. Bloom glow entrance ---
  private _animBloom(canvas: HTMLCanvasElement) {
    canvas.style.opacity = '1'

    // Use directional light intensity as bloom stand-in
    const light = this._directionalLight
    if (!light) {
      this._animSoftRise(canvas)
      return
    }

    // Start with bright glow + slight blur
    canvas.style.filter = 'blur(4px) brightness(2)'
    light.intensity = 5.0
    light.color.setHex(0xaaddff)

    // Hide VRM initially
    const meshes: THREE.Mesh[] = []
    this.model?.vrm?.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.Material
        mat.transparent = true
        mat.opacity = 0
        meshes.push(mesh)
      }
    })

    const duration = 1800
    const start = performance.now()
    const baseIntensity = 1.8 * settingsStore.getState().lightingIntensity

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 2)

      // Model fades in
      meshes.forEach((mesh) => {
        ;(mesh.material as THREE.Material).opacity = eased
      })

      // Light intensity decreases from bright to normal
      light.intensity = 5.0 + (baseIntensity - 5.0) * eased
      // Light color returns to white
      const b = Math.round(0xaa + (0xff - 0xaa) * eased)
      light.color.setRGB(
        (0xaa + (0xff - 0xaa) * eased) / 255,
        (0xdd + (0xff - 0xdd) * eased) / 255,
        b / 255
      )

      // Blur + brightness reduce
      const blur = 4 * (1 - eased)
      const brightness = 2 - 1 * eased
      canvas.style.filter = `blur(${blur}px) brightness(${brightness})`

      if (t < 1) {
        this._entranceRafId = requestAnimationFrame(animate)
      } else {
        canvas.style.filter = ''
        light.intensity = baseIntensity
        light.color.setHex(0xffffff)
        meshes.forEach((mesh) => {
          const mat = mesh.material as THREE.Material
          mat.opacity = 1
          mat.transparent = false
        })
      }
    }
    this._entranceRafId = requestAnimationFrame(animate)
  }

  /**
   * Reactで管理しているCanvasを後から設定する
   */
  public setup(canvas: HTMLCanvasElement) {
    const parentElement = canvas.parentElement
    const width = parentElement?.clientWidth || canvas.width
    const height = parentElement?.clientHeight || canvas.height
    // renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
    })
    this._renderer.setSize(width, height)
    this._renderer.setPixelRatio(window.devicePixelRatio)

    // camera
    this._camera = new THREE.PerspectiveCamera(20.0, width / height, 0.1, 20.0)
    this._camera.position.set(0, 1.3, 1.5)
    this._cameraControls?.target.set(0, 1.3, 0)
    this._cameraControls?.update()
    // camera controls
    this._cameraControls = new OrbitControls(
      this._camera,
      this._renderer.domElement
    )
    this._cameraControls.screenSpacePanning = true
    this._cameraControls.update()

    // Listen for position lock changes
    this._cameraControls.addEventListener('end', () => {
      this.saveCameraPosition()
    })

    window.addEventListener('resize', () => {
      this.resize()
    })
    // Hide canvas until VRM model is loaded and ready
    canvas.style.opacity = '0'
    canvas.style.filter = ''
    canvas.style.transform = ''
    canvas.style.clipPath = ''

    this.isReady = true
    this.update()

    // Restore saved position if available
    this.restoreCameraPosition()
  }

  /**
   * canvasの親要素を参照してサイズを変更する
   */
  public resize() {
    if (!this._renderer) return

    const parentElement = this._renderer.domElement.parentElement
    if (!parentElement) return

    this._renderer.setPixelRatio(window.devicePixelRatio)
    this._renderer.setSize(
      parentElement.clientWidth,
      parentElement.clientHeight
    )

    if (!this._camera) return
    this._camera.aspect = parentElement.clientWidth / parentElement.clientHeight
    this._camera.updateProjectionMatrix()
  }

  /**
   * VRMのheadノードを参照してカメラ位置を調整する
   */
  public resetCamera() {
    // First, set default position based on head node
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode('head')

    if (headNode) {
      const headWPos = headNode.getWorldPosition(new THREE.Vector3())

      this._camera?.position.set(
        this._camera.position.x,
        headWPos.y,
        this._camera?.position.z ?? 1.5
      )
      this._cameraControls?.target.set(headWPos.x, headWPos.y, headWPos.z)
      this._cameraControls?.update()
    }

    // Then restore saved camera position and rotation
    this.restoreCameraPosition()
  }

  public update = () => {
    requestAnimationFrame(this.update)
    const delta = this._clock.getDelta()
    // update vrm components
    if (this.model) {
      this.model.update(delta)
    }

    if (this._renderer && this._camera) {
      this._renderer.render(this._scene, this._camera)
    }
  }

  /**
   * 現在のカメラ位置を設定に保存する
   */
  public saveCameraPosition() {
    if (!this._camera || !this._cameraControls) return

    const settings = settingsStore.getState()
    settingsStore.setState({
      characterPosition: {
        x: this._camera.position.x,
        y: this._camera.position.y,
        z: this._camera.position.z,
        scale: settings.characterPosition?.scale ?? 1,
      },
      characterRotation: {
        x: this._cameraControls.target.x,
        y: this._cameraControls.target.y,
        z: this._cameraControls.target.z,
      },
    })
  }

  /**
   * 保存されたカメラ位置を復元する
   */
  public restoreCameraPosition() {
    if (!this._camera || !this._cameraControls) return

    const { characterPosition, characterRotation } = settingsStore.getState()

    if (
      characterPosition.x === 0 &&
      characterPosition.y === 0 &&
      characterPosition.z === 0
    ) {
      return
    }

    this._camera.position.set(
      characterPosition.x,
      characterPosition.y,
      characterPosition.z
    )
    this._cameraControls.target.set(
      characterRotation.x,
      characterRotation.y,
      characterRotation.z
    )
    this._cameraControls.update()
  }

  /**
   * カメラ位置を固定する
   */
  public fixCameraPosition() {
    this.saveCameraPosition()
    settingsStore.setState({ fixedCharacterPosition: true })
    if (this._cameraControls) {
      this._cameraControls.enabled = false
    }
  }

  /**
   * カメラ位置の固定を解除する
   */
  public unfixCameraPosition() {
    settingsStore.setState({ fixedCharacterPosition: false })
    if (this._cameraControls) {
      this._cameraControls.enabled = true
    }
  }

  /**
   * カメラ位置をリセットする
   */
  public resetCameraPosition() {
    settingsStore.setState({
      fixedCharacterPosition: false,
      characterPosition: { x: 0, y: 0, z: 0, scale: 1 },
      characterRotation: { x: 0, y: 0, z: 0 },
    })
    if (this._cameraControls) {
      this._cameraControls.enabled = true
    }
    this.resetCamera()
  }

  /**
   * ライトの強度を更新する
   */
  public updateLightingIntensity(intensity: number) {
    if (this._directionalLight) {
      this._directionalLight.intensity = 1.8 * intensity
    }
    if (this._ambientLight) {
      this._ambientLight.intensity = 1.2 * intensity
    }
  }
}
