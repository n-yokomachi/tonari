import { useEffect, useRef } from 'react'
import homeStore from '@/features/stores/home'
import pomodoroStore from '@/features/stores/pomodoro'
import { GestureType } from '@/features/emoteController/gestures/types'
import { GesturePlayOptions } from '@/features/emoteController/gestureController'

interface WorkMotionConfig {
  gesture: GestureType
  options?: GesturePlayOptions
}

const WORK_MOTIONS: WorkMotionConfig[] = [
  {
    gesture: 'cheer',
    options: { speed: 0.8 },
  },
  {
    gesture: 'wave',
    options: { speed: 0.7 },
  },
  {
    gesture: 'present',
    options: { speed: 0.6 },
  },
]

const MIN_INTERVAL = 60000 // 最小間隔（60秒）
const MAX_INTERVAL = 180000 // 最大間隔（180秒）

const getRandomInterval = () =>
  Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) + MIN_INTERVAL

const getRandomMotion = () =>
  WORK_MOTIONS[Math.floor(Math.random() * WORK_MOTIONS.length)]

export const usePomodoroMotion = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const scheduleNext = () => {
      clearTimer()
      timerRef.current = setTimeout(() => {
        const { viewer, chatProcessing } = homeStore.getState()
        const phase = pomodoroStore.getState().phase
        if (phase === 'work' && !chatProcessing && viewer?.model) {
          const motion = getRandomMotion()
          viewer.model.playGesture(motion.gesture, motion.options)
        }
        // 作業フェーズが続いていればスケジュール継続
        if (pomodoroStore.getState().phase === 'work') {
          scheduleNext()
        }
      }, getRandomInterval())
    }

    // pomodoroのphase変更を監視
    const unsub = pomodoroStore.subscribe((state, prev) => {
      if (state.phase === 'work' && prev.phase !== 'work') {
        // 作業フェーズ開始 → モーションスケジュール開始
        scheduleNext()
      } else if (state.phase !== 'work' && prev.phase === 'work') {
        // 作業フェーズ終了 → タイマークリア
        clearTimer()
      }
    })

    // 初期状態が既にworkフェーズの場合
    if (pomodoroStore.getState().phase === 'work') {
      scheduleNext()
    }

    return () => {
      unsub()
      clearTimer()
    }
  }, [])
}
