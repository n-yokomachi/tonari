import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { IconButton } from './iconButton'

type CameraState = 'idle' | 'previewing' | 'captured' | 'denied'

const MAX_IMAGE_DIMENSION = 1024
const JPEG_QUALITY = 0.85

/**
 * Resize and capture a video frame as a JPEG data URL.
 * Long edge is capped at MAX_IMAGE_DIMENSION px.
 */
function captureFrame(video: HTMLVideoElement): string {
  const { videoWidth, videoHeight } = video
  let width = videoWidth
  let height = videoHeight

  const longEdge = Math.max(width, height)
  if (longEdge > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / longEdge
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

function stopStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
}

/**
 * Check if the browser supports getUserMedia.
 */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  )
}

/**
 * Auto-capture toggle shown in camera preview.
 */
const AutoCaptureToggle = () => {
  const { t } = useTranslation()
  const enableAutoCapture = settingsStore((s) => s.enableAutoCapture)

  return (
    <button
      onClick={() =>
        settingsStore.setState({ enableAutoCapture: !enableAutoCapture })
      }
      className={`text-xs px-2 py-1 rounded transition-colors ${
        enableAutoCapture
          ? 'bg-secondary/80 text-white'
          : 'bg-white/20 text-white/60'
      }`}
    >
      {enableAutoCapture ? t('AutoCaptureEnabled') : t('AutoCaptureDisabled')}
    </button>
  )
}

/**
 * Camera toggle button. Hidden if browser doesn't support getUserMedia.
 */
export const CameraButton = () => {
  const { t } = useTranslation()
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const cameraOpen = homeStore((s) => s.cameraOpen)

  if (!isCameraSupported() || cameraOpen) {
    return null
  }

  return (
    <IconButton
      iconName="24/Camera"
      isProcessing={false}
      disabled={chatProcessing}
      onClick={() => homeStore.setState({ cameraOpen: true })}
      className="bg-white/70 hover:bg-white hover:shadow-md border border-gray-400/60 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700/70 dark:hover:bg-gray-600 dark:border-gray-500/60"
      iconColor="text-gray-700 dark:text-gray-300"
      aria-label={t('OpenCamera')}
    />
  )
}

/**
 * Camera preview panel. Shows live preview, capture controls, and captured image.
 * Renders nothing when camera is closed.
 */
export const CameraPreview = () => {
  const { t } = useTranslation()
  const cameraOpen = homeStore((s) => s.cameraOpen)
  const triggerShutter = homeStore((s) => s.triggerShutter)

  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [capturedImage, setCapturedImage] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraState('previewing')
      homeStore.setState({ webcamStatus: true })
    } catch {
      setCameraState('denied')
      homeStore.setState({ webcamStatus: false })
    }
  }, [])

  const stopCamera = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    homeStore.setState({ webcamStatus: false })
  }, [])

  const handleClose = useCallback(() => {
    stopCamera()
    setCameraState('idle')
    setCapturedImage('')
    homeStore.setState({ cameraOpen: false })
  }, [stopCamera])

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return
    const dataUrl = captureFrame(videoRef.current)
    if (!dataUrl) return
    setCapturedImage(dataUrl)
    setCameraState('captured')
    stopCamera()
  }, [stopCamera])

  const handleRetake = useCallback(async () => {
    setCapturedImage('')
    homeStore.setState({ modalImage: '' })
    await startCamera()
  }, [startCamera])

  const handleSend = useCallback(() => {
    if (capturedImage) {
      homeStore.setState({ modalImage: capturedImage })
    }
    setCapturedImage('')
    setCameraState('idle')
    homeStore.setState({ cameraOpen: false })
  }, [capturedImage])

  // Start camera when opened
  useEffect(() => {
    if (cameraOpen && cameraState === 'idle') {
      startCamera()
    }
  }, [cameraOpen, cameraState, startCamera])

  // Attach stream to video element after it mounts (state → 'previewing')
  useEffect(() => {
    if (cameraState === 'previewing' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraState])

  // Handle triggerShutter (Phase 2: agent-triggered capture)
  useEffect(() => {
    if (!triggerShutter) return
    homeStore.setState({ triggerShutter: false })

    if (cameraState === 'previewing' && videoRef.current) {
      const dataUrl = captureFrame(videoRef.current)
      if (dataUrl) {
        homeStore.setState({ modalImage: dataUrl })
      }
    }
  }, [triggerShutter, cameraState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream(streamRef.current)
    }
  }, [])

  if (!cameraOpen) {
    return null
  }

  return (
    <div className="mb-2 rounded-lg overflow-hidden bg-gray-900 relative">
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label={t('CloseCamera')}
      >
        ×
      </button>

      {cameraState === 'denied' && (
        <div className="p-6 text-center text-white/80 text-sm">
          <p>{t('CameraDenied')}</p>
          <button
            onClick={handleClose}
            className="mt-3 px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm"
          >
            {t('Close')}
          </button>
        </div>
      )}

      {cameraState === 'previewing' && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-64 object-contain bg-black"
          />
          <div className="flex items-center justify-between px-3 py-2 bg-gray-900">
            <AutoCaptureToggle />
            <IconButton
              iconName="24/Shutter"
              isProcessing={false}
              onClick={handleCapture}
              className="bg-white hover:bg-gray-100 active:bg-gray-200"
              iconColor="text-gray-800"
              aria-label={t('TakePhoto')}
            />
            <div className="w-10" />
          </div>
        </>
      )}

      {cameraState === 'captured' && capturedImage && (
        <>
          <Image
            src={capturedImage}
            alt="Captured"
            width={0}
            height={0}
            sizes="100vw"
            className="w-full max-h-64 object-contain bg-black"
          />
          <div className="flex justify-center gap-3 py-2 bg-gray-900">
            <IconButton
              iconName="24/Refresh"
              isProcessing={false}
              onClick={handleRetake}
              className="bg-white/20 hover:bg-white/30"
              aria-label={t('Retake')}
            />
            <IconButton
              iconName="24/Check"
              isProcessing={false}
              onClick={handleSend}
              className="bg-secondary hover:bg-secondary-hover"
              aria-label={t('UsePhoto')}
            />
          </div>
        </>
      )}
    </div>
  )
}
