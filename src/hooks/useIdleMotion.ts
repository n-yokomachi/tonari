import { useEffect, useRef } from 'react'
import homeStore from '@/features/stores/home'
import { GestureType } from '@/features/emoteController/gestures/types'
import { GesturePlayOptions } from '@/features/emoteController/gestureController'

interface IdleMotionConfig {
  gesture: GestureType
  options?: GesturePlayOptions
}

const IDLE_MOTIONS: IdleMotionConfig[] = [
  {
    gesture: 'think',
    options: { holdDuration: 20.0, speed: 0.7 },
  },
  {
    gesture: 'head_tilt',
    options: { speed: 0.5 },
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

  // 待機モーションのスケジューリング
  useEffect(() => {
    const scheduleNext = () => {
      timerRef.current = setTimeout(() => {
        const { viewer, chatProcessing, isSleeping } = homeStore.getState()
        if (!chatProcessing && !isSleeping && viewer?.model) {
          const motion = getRandomMotion()
          viewer.model.playGesture(motion.gesture, motion.options)
        }
        scheduleNext()
      }, getRandomInterval())
    }

    scheduleNext()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // chatProcessing開始時に待機モーションを中断
  useEffect(() => {
    let prev = homeStore.getState().chatProcessing
    const unsub = homeStore.subscribe((state) => {
      if (state.chatProcessing && !prev) {
        state.viewer?.model?.cancelGesture()
      }
      prev = state.chatProcessing
    })
    return unsub
  }, [])
}
