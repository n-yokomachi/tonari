import { useEffect, useRef } from 'react'
import { VRMExpressionPresetName } from '@pixiv/three-vrm'
import homeStore from '@/features/stores/home'
import pomodoroStore from '@/features/stores/pomodoro'
import { GestureType } from '@/features/emoteController/gestures/types'
import { GesturePlayOptions } from '@/features/emoteController/gestureController'
import { gestureDefinitions } from '@/features/emoteController/gestures'

interface IdleMotionConfig {
  gesture: GestureType
  options?: GesturePlayOptions
  emotion?: VRMExpressionPresetName
  emotionWeight?: number
}

const IDLE_MOTIONS: IdleMotionConfig[] = [
  {
    gesture: 'think',
    options: { holdDuration: 20.0, speed: 0.7 },
  },
  {
    gesture: 'head_tilt',
    options: { speed: 0.5 },
    emotion: 'relaxed',
    emotionWeight: 0.5,
  },
]

const MIN_INTERVAL = 30000 // 最小間隔（30秒）
const MAX_INTERVAL = 90000 // 最大間隔（90秒）

const getRandomInterval = () =>
  Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) + MIN_INTERVAL

const getRandomMotion = () =>
  IDLE_MOTIONS[Math.floor(Math.random() * IDLE_MOTIONS.length)]

export const useIdleMotion = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 待機モーションのスケジューリング
  useEffect(() => {
    const scheduleNext = () => {
      timerRef.current = setTimeout(() => {
        const { viewer, chatProcessing, isSleeping } = homeStore.getState()
        const pomodoroPhase = pomodoroStore.getState().phase
        if (
          !chatProcessing &&
          !isSleeping &&
          pomodoroPhase !== 'work' &&
          viewer?.model
        ) {
          const motion = getRandomMotion()
          if (motion.emotion) {
            viewer.model.playEmotion(motion.emotion, motion.emotionWeight)
            const def = gestureDefinitions.get(motion.gesture)
            if (def) {
              const speed = motion.options?.speed ?? 1
              const tiltTime =
                def.keyframes.reduce((s, kf) => s + kf.duration, 0) / speed
              const holdTime = motion.options?.holdDuration ?? def.holdDuration
              const returnTime = 0.8 / speed
              const totalMs = (tiltTime + holdTime + returnTime) * 1000 + 500
              emotionTimerRef.current = setTimeout(() => {
                viewer.model?.playEmotion('neutral')
              }, totalMs)
            }
          }
          viewer.model.playGesture(motion.gesture, motion.options)
        }
        scheduleNext()
      }, getRandomInterval())
    }

    scheduleNext()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current)
    }
  }, [])

  // chatProcessing開始時に待機モーションを中断
  useEffect(() => {
    let prev = homeStore.getState().chatProcessing
    const unsub = homeStore.subscribe((state) => {
      if (state.chatProcessing && !prev) {
        if (emotionTimerRef.current) {
          clearTimeout(emotionTimerRef.current)
          emotionTimerRef.current = null
        }
        state.viewer?.model?.cancelGesture()
        state.viewer?.model?.playEmotion('neutral')
      }
      prev = state.chatProcessing
    })
    return unsub
  }, [])
}
