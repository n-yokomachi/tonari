import { useCallback, useEffect, useRef } from 'react'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'

export default function VrmViewer() {
  const containerRef = useRef<HTMLDivElement>(null)

  // ダークモード切替時にVRMライティングを調整
  useEffect(() => {
    const unsub = settingsStore.subscribe((state) => {
      const { viewer } = homeStore.getState()
      const isDark = state.colorTheme === 'tonari-dark'
      viewer.updateLightingIntensity(isDark ? 0.3 : 1.0)
    })
    return () => unsub()
  }, [])

  // ResizeObserverでコンテナサイズの変更を検知
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      const { viewer } = homeStore.getState()
      viewer.resize()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const canvasRef = useCallback((canvas: HTMLCanvasElement) => {
    if (canvas) {
      const { viewer } = homeStore.getState()
      const { selectedVrmPath, colorTheme } = settingsStore.getState()
      viewer.setup(canvas)
      viewer.updateLightingIntensity(colorTheme === 'tonari-dark' ? 0.3 : 1.0)
      viewer.loadVrm(selectedVrmPath)

      // Drag and DropでVRMを差し替え
      canvas.addEventListener('dragover', function (event) {
        event.preventDefault()
      })

      canvas.addEventListener('drop', function (event) {
        event.preventDefault()

        const files = event.dataTransfer?.files
        if (!files) {
          return
        }

        const file = files[0]
        if (!file) {
          return
        }
        const file_type = file.name.split('.').pop()
        if (file_type === 'vrm') {
          const blob = new Blob([file], { type: 'application/octet-stream' })
          const url = window.URL.createObjectURL(blob)
          viewer.loadVrm(url)
        } else if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = function () {
            const image = reader.result as string
            image !== '' && homeStore.setState({ modalImage: image })
          }
        }
      })
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={'relative w-full h-full overflow-hidden bg-transparent'}
    >
      <canvas
        ref={canvasRef}
        className={'h-full w-full bg-transparent'}
      ></canvas>
    </div>
  )
}
