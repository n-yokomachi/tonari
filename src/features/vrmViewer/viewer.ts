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
                const types: EntranceAnimationType[] = [
                  'softRise' /*, 'glitch' */,
                ]
                const pick = types[Math.floor(Math.random() * types.length)]
                this.playEntranceAnimation(canvas, pick)
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
    // Remove glitch ghost images
    document
      .querySelectorAll('[data-glitch-ghost]')
      .forEach((el) => el.remove())
    // Reset canvas styles only (never touch VRM materials)
    const canvas = this._renderer?.domElement
    if (canvas) {
      canvas.style.transition = 'none'
      canvas.style.filter = ''
      canvas.style.transform = ''
      canvas.style.clipPath = ''
      canvas.style.opacity = '1'
      canvas.style.animation = ''
    }
    // Reset light (respecting dark mode)
    if (this._directionalLight) {
      const intensity = this._currentLightingIntensity()
      this._directionalLight.intensity = 1.8 * intensity
      this._directionalLight.color.setHex(0xffffff)
    }
    if (this._ambientLight) {
      const intensity = this._currentLightingIntensity()
      this._ambientLight.intensity = 1.2 * intensity
    }
  }

  // --- 1. Soft Rise (CSS: translateY + blur + opacity) ---
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

  // --- 2. Dissolve (CSS: slow opacity fade only) ---
  private _animDissolve(canvas: HTMLCanvasElement) {
    canvas.style.transition = 'none'
    canvas.style.opacity = '0'
    void canvas.offsetHeight
    canvas.style.transition = 'opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1)'
    requestAnimationFrame(() => {
      canvas.style.opacity = '1'
    })
  }

  // --- 3. Soft Rise + Particle (CSS fade + Three.js particles) ---
  private _animParticle(canvas: HTMLCanvasElement) {
    // CSS soft rise for the model
    canvas.style.transition = 'none'
    canvas.style.opacity = '0'
    canvas.style.transform = 'translateY(20px)'
    canvas.style.filter = 'blur(4px)'
    void canvas.offsetHeight
    canvas.style.transition =
      'opacity 1.8s ease-out, transform 1.8s cubic-bezier(0.22, 1, 0.36, 1), filter 1.8s ease-out'
    requestAnimationFrame(() => {
      canvas.style.opacity = '1'
      canvas.style.transform = 'translateY(0)'
      canvas.style.filter = 'blur(0px)'
    })

    // Three.js particles spiraling around the model
    // Force world matrix update so bone positions are correct on initial load
    this.model?.vrm?.scene.updateMatrixWorld(true)
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode('head')
    const headPos = headNode
      ? headNode.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(0, 1.3, 0)
    const centerX = headPos.x
    const centerY = headPos.y
    const centerZ = headPos.z

    const count = 150
    const angles = new Float32Array(count)
    const radii = new Float32Array(count)
    const startY = new Float32Array(count)
    const riseSpeed = new Float32Array(count)
    const angularSpeed = new Float32Array(count)
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      angles[i] = Math.random() * Math.PI * 2
      radii[i] = 0.1 + Math.random() * 0.2
      startY[i] = centerY - 0.5 + Math.random() * 0.3
      riseSpeed[i] = 0.3 + Math.random() * 0.5
      angularSpeed[i] = 1.5 + Math.random() * 2.5
      const i3 = i * 3
      positions[i3] = centerX + Math.cos(angles[i]) * radii[i]
      positions[i3 + 1] = startY[i]
      positions[i3 + 2] = centerZ + Math.sin(angles[i]) * radii[i]
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Generate circular particle texture
    const texCanvas = document.createElement('canvas')
    texCanvas.width = 32
    texCanvas.height = 32
    const ctx = texCanvas.getContext('2d')!
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.4, 'rgba(255,255,255,0.8)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
    const particleTex = new THREE.CanvasTexture(texCanvas)

    const particleMat = new THREE.PointsMaterial({
      color: 0xaaddff,
      size: 0.08,
      map: particleTex,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true,
    })

    this._particleSystem = new THREE.Points(geometry, particleMat)
    this._scene.add(this._particleSystem)

    const duration = 2500
    const start = performance.now()

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const elapsed = (now - start) / 1000

      // Spiral upward around model
      const posAttr = geometry.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const angle = angles[i] + elapsed * angularSpeed[i]
        const r = radii[i] * (1 - t * 0.3) // slightly tighten spiral
        const y = startY[i] + elapsed * riseSpeed[i]
        arr[i3] = centerX + Math.cos(angle) * r
        arr[i3 + 1] = y
        arr[i3 + 2] = centerZ + Math.sin(angle) * r
      }
      posAttr.needsUpdate = true

      // Particles fade out in the second half
      particleMat.opacity = t < 0.4 ? 0.9 : 0.9 * (1 - (t - 0.4) / 0.6)

      if (t < 1) {
        this._entranceRafId = requestAnimationFrame(animate)
      } else {
        this._scene.remove(this._particleSystem!)
        geometry.dispose()
        particleTex.dispose()
        particleMat.dispose()
        this._particleSystem = undefined
      }
    }
    this._entranceRafId = requestAnimationFrame(animate)
  }

  // --- 4. Digital glitch (ghost afterimages + jitter + color split) ---

  private _animGlitch(canvas: HTMLCanvasElement) {
    canvas.style.opacity = '0'

    const parent = canvas.parentElement
    if (!parent || !this._renderer || !this._camera) {
      this._animSoftRise(canvas)
      return
    }

    // Capture a snapshot of the current model render (alpha-preserved)
    this._renderer.render(this._scene, this._camera)
    const snapshotUrl = canvas.toDataURL('image/png')

    // Create ghost afterimage layers with color tints and offsets
    const ghosts: {
      el: HTMLImageElement
      baseOffsetX: number
      baseOffsetY: number
      hue: number
    }[] = [
      { el: null!, baseOffsetX: -12, baseOffsetY: -4, hue: 0 }, // red-ish
      { el: null!, baseOffsetX: 8, baseOffsetY: 6, hue: 180 }, // cyan-ish
      { el: null!, baseOffsetX: -5, baseOffsetY: 10, hue: 270 }, // purple-ish
    ]

    for (const ghost of ghosts) {
      const img = document.createElement('img')
      img.src = snapshotUrl
      img.setAttribute('data-glitch-ghost', '')
      img.style.cssText =
        'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;' +
        'opacity:0;mix-blend-mode:screen;'
      parent.appendChild(img)
      ghost.el = img
    }

    const duration = 1800
    const start = performance.now()
    let nextGlitch = start

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)

      if (t >= 1) {
        canvas.style.filter = ''
        canvas.style.transform = ''
        canvas.style.opacity = '1'
        for (const ghost of ghosts) ghost.el.remove()
        return
      }

      const intensity = 1 - t

      if (now >= nextGlitch) {
        // Main canvas: jitter + flicker
        const jitterX = (Math.random() - 0.5) * 8 * intensity
        canvas.style.transform = `translateX(${jitterX}px)`

        // Blackout frames
        if (Math.random() < 0.12 * intensity) {
          canvas.style.opacity = '0'
        } else {
          canvas.style.opacity = String(0.4 + t * 0.6)
        }

        canvas.style.filter = `hue-rotate(${Math.random() * 60 * intensity}deg) saturate(${1 + intensity})`

        // Animate ghost afterimages
        for (const ghost of ghosts) {
          const jX =
            ghost.baseOffsetX * intensity +
            (Math.random() - 0.5) * 15 * intensity
          const jY =
            ghost.baseOffsetY * intensity +
            (Math.random() - 0.5) * 10 * intensity
          ghost.el.style.transform = `translate(${jX}px, ${jY}px)`
          ghost.el.style.filter = `hue-rotate(${ghost.hue + Math.random() * 40}deg) saturate(2)`

          // Ghosts flicker independently
          if (Math.random() < 0.3) {
            ghost.el.style.opacity = '0'
          } else {
            ghost.el.style.opacity = String(0.4 * intensity)
          }
        }

        nextGlitch = now + 40 + (1 - intensity) * 50
      }

      this._entranceRafId = requestAnimationFrame(animate)
    }
    this._entranceRafId = requestAnimationFrame(animate)
  }

  // --- 5. Bloom glow entrance (CSS filter + light only) ---
  private _animBloom(canvas: HTMLCanvasElement) {
    const light = this._directionalLight
    if (!light) {
      this._animSoftRise(canvas)
      return
    }

    // Start hidden, with bright light
    canvas.style.transition = 'none'
    canvas.style.opacity = '0'
    canvas.style.filter = 'blur(8px)'
    light.intensity = 4.0
    light.color.setHex(0xaaddff)
    void canvas.offsetHeight

    const duration = 1800
    const start = performance.now()
    const baseIntensity = 1.8 * this._currentLightingIntensity()

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)

      // Canvas fades in
      canvas.style.opacity = String(eased)

      // Blur decreases
      const blur = 8 * (1 - eased)
      canvas.style.filter = `blur(${blur}px)`

      // Light returns to normal
      light.intensity = 4.0 + (baseIntensity - 4.0) * eased
      const r = (0xaa + (0xff - 0xaa) * eased) / 255
      const g = (0xdd + (0xff - 0xdd) * eased) / 255
      const b = 1.0
      light.color.setRGB(r, g, b)

      if (t < 1) {
        this._entranceRafId = requestAnimationFrame(animate)
      } else {
        canvas.style.filter = ''
        canvas.style.transition = ''
        light.intensity = baseIntensity
        light.color.setHex(0xffffff)
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

  private _currentLightingIntensity(): number {
    const { colorTheme } = settingsStore.getState()
    return colorTheme === 'tonari-dark' ? 0.3 : 1.0
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
