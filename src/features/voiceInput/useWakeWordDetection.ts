import { useEffect, useRef } from 'react'
import { usePorcupine } from '@picovoice/porcupine-react'

import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import voiceInputStore from '@/features/stores/voiceInput'
import toastStore from '@/features/stores/toast'
import { handleSendChatFn } from '@/features/chat/handlers'
import { createSpeechRecognitionService } from './speechRecognitionService'
import type { SpeechRecognitionService } from './speechRecognitionService'

// Porcupine model paths (placed by manual prerequisites 0.2, 0.3)
const PORCUPINE_MODEL_PATH = '/models/porcupine/porcupine_params_ja.pv'
const PORCUPINE_KEYWORD_PATH = '/models/porcupine/tonari_ja_wasm.ppn'
const DETECTION_SOUND_PATH = '/sounds/wake-word-detected.mp3'

const SILENCE_TIMEOUT = 3000
const FOLLOW_UP_TIMEOUT = 10000

export const useWakeWordDetection = () => {
  const wakeWordEnabled = settingsStore((s) => s.wakeWordEnabled)

  const porcupine = usePorcupine()
  const porcupineRef = useRef(porcupine)
  porcupineRef.current = porcupine

  const sttRef = useRef<SpeechRecognitionService | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processingUnsubRef = useRef<(() => void) | null>(null)
  const initializedRef = useRef(false)
  const accessKeyRef = useRef('')

  // Lazy-init STT service (browser-only)
  if (typeof window !== 'undefined' && !sttRef.current) {
    sttRef.current = createSpeechRecognitionService()
  }

  // --- Timer helpers ---

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const clearFollowUpTimer = () => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current)
      followUpTimerRef.current = null
    }
  }

  const cleanupAll = () => {
    clearSilenceTimer()
    clearFollowUpTimer()
    sttRef.current?.abort()
    processingUnsubRef.current?.()
    processingUnsubRef.current = null
  }

  // --- Core flow functions ---

  const returnToIdle = async () => {
    cleanupAll()
    const store = voiceInputStore.getState()
    store.setPhase('idle')
    store.setInterimTranscript('')
    store.setFinalTranscript('')
    if (initializedRef.current) {
      porcupineRef.current.start()
    }
  }

  const startListening = () => {
    const stt = sttRef.current
    if (!stt?.isSupported) return

    stt.start({
      onInterimResult: (transcript) => {
        voiceInputStore.getState().setInterimTranscript(transcript)

        // awaitingFollowUp → listening (user started talking)
        if (voiceInputStore.getState().phase === 'awaitingFollowUp') {
          clearFollowUpTimer()
          voiceInputStore.getState().setPhase('listening')
        }

        // User is talking, clear silence timer
        clearSilenceTimer()
      },

      onFinalResult: (transcript) => {
        voiceInputStore.getState().appendToFinalTranscript(transcript)
        voiceInputStore.getState().setInterimTranscript('')
      },

      onEnd: () => {
        const phase = voiceInputStore.getState().phase
        if (phase !== 'listening' && phase !== 'awaitingFollowUp') return

        // Start silence timer
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null
          const finalText = voiceInputStore.getState().finalTranscript.trim()

          if (!finalText) {
            returnToIdle()
            return
          }

          sendTranscript(finalText)
        }, SILENCE_TIMEOUT)

        // Restart STT immediately to catch continued speech
        startListening()
      },

      onError: (error) => {
        console.error('STT error:', error)
        returnToIdle()
      },
    })
  }

  const sendTranscript = (text: string) => {
    const store = voiceInputStore.getState()
    store.setInterimTranscript('')
    store.setFinalTranscript('')

    store.setPhase('processing')
    handleSendChatFn()(text)
    watchProcessingCompletion()
  }

  const watchProcessingCompletion = () => {
    processingUnsubRef.current?.()

    let prevProcessing = homeStore.getState().chatProcessing
    let prevSpeaking = homeStore.getState().isSpeaking

    processingUnsubRef.current = homeStore.subscribe((state) => {
      const wasActive = prevProcessing || prevSpeaking
      const isActive = state.chatProcessing || state.isSpeaking
      prevProcessing = state.chatProcessing
      prevSpeaking = state.isSpeaking

      if (wasActive && !isActive) {
        if (voiceInputStore.getState().phase === 'processing') {
          processingUnsubRef.current?.()
          processingUnsubRef.current = null
          enterFollowUp()
        }
      }
    })
  }

  const enterFollowUp = () => {
    voiceInputStore.getState().setPhase('awaitingFollowUp')
    startListening()

    followUpTimerRef.current = setTimeout(() => {
      followUpTimerRef.current = null
      returnToIdle()
    }, FOLLOW_UP_TIMEOUT)
  }

  // --- Effect: Initialize/cleanup Porcupine based on settings ---

  useEffect(() => {
    if (!wakeWordEnabled) {
      if (initializedRef.current) {
        cleanupAll()
        porcupineRef.current.release()
        initializedRef.current = false
      }
      voiceInputStore.getState().setPhase('disabled')
      return
    }

    let aborted = false

    const initPorcupine = async () => {
      try {
        // Fetch access key from server-side API
        const res = await fetch('/api/picovoice-key')
        if (!res.ok) throw new Error('Failed to fetch access key')
        const { accessKey } = await res.json()
        if (aborted) return
        accessKeyRef.current = accessKey

        await porcupineRef.current.init(
          accessKey,
          {
            publicPath: PORCUPINE_KEYWORD_PATH,
            label: 'TONaRi',
            sensitivity: 0.5,
          },
          { publicPath: PORCUPINE_MODEL_PATH }
        )
        if (aborted) return
        await porcupineRef.current.start()
        initializedRef.current = true
        voiceInputStore.getState().setPhase('idle')
      } catch (e) {
        if (aborted) return
        console.error('Porcupine init error:', e)
        toastStore.getState().addToast({
          message: 'ウェイクワード検知の初期化に失敗しました',
          type: 'error',
        })
        settingsStore.setState({ wakeWordEnabled: false })
      }
    }

    initPorcupine()

    return () => {
      aborted = true
      cleanupAll()
      if (initializedRef.current) {
        porcupineRef.current.release()
        initializedRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWordEnabled])

  // --- Effect: Handle wake word detection ---

  useEffect(() => {
    if (!porcupine.keywordDetection) return

    const handleDetection = async () => {
      // Play detection sound
      try {
        const audio = new Audio(DETECTION_SOUND_PATH)
        await audio.play()
      } catch {
        // Autoplay policy may block
      }

      // Wake avatar if sleeping
      const { viewer, isSleeping } = homeStore.getState()
      if (isSleeping) {
        viewer?.model?.wakeUp()
        homeStore.setState({ isSleeping: false })
      }

      // Stop Porcupine → Start STT (sequential mic switching)
      await porcupineRef.current.stop()

      const store = voiceInputStore.getState()
      store.setPhase('listening')
      store.setFinalTranscript('')
      store.setInterimTranscript('')

      if (!sttRef.current?.isSupported) {
        toastStore.getState().addToast({
          message: 'お使いのブラウザは音声認識に対応していません',
          type: 'error',
        })
        returnToIdle()
        return
      }

      startListening()
    }

    handleDetection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porcupine.keywordDetection])

  // --- Effect: Handle Porcupine errors ---

  useEffect(() => {
    if (!porcupine.error) return
    // Suppress the race condition error during init/cleanup
    if (porcupine.error.message?.includes('has not been initialized')) return
    console.error('Porcupine error:', porcupine.error)
    toastStore.getState().addToast({
      message: `ウェイクワード検知エラー: ${porcupine.error.message}`,
      type: 'error',
    })
  }, [porcupine.error])
}
