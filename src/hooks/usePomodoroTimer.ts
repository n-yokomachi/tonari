import { useEffect, useRef } from 'react'
import pomodoroStore, { PomodoroPhase } from '@/features/stores/pomodoro'

const playPhaseSound = (phase: 'work' | 'break') => {
  const { volume } = pomodoroStore.getState()
  if (volume <= 0) return
  const audio = new Audio(
    phase === 'work' ? '/sounds/work.mp3' : '/sounds/break.mp3'
  )
  audio.volume = volume / 100
  audio.play().catch(() => {})
}

export const usePomodoroTimer = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTickRef = useRef<number>(Date.now())
  const prevPhaseRef = useRef<PomodoroPhase>(pomodoroStore.getState().phase)

  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) return
      lastTickRef.current = Date.now()
      intervalRef.current = setInterval(() => {
        const { isRunning } = pomodoroStore.getState()
        if (isRunning) {
          pomodoroStore.getState().tick()
        }
        lastTickRef.current = Date.now()
      }, 1000)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    // visibilitychange でタブ復帰時に時間を補正
    const handleVisibilityChange = () => {
      if (document.hidden) return

      const { isRunning, timeRemaining, phase } = pomodoroStore.getState()
      if (!isRunning || (phase !== 'work' && phase !== 'break')) return

      const elapsed = Math.floor((Date.now() - lastTickRef.current) / 1000)
      if (elapsed > 1) {
        // 複数秒分をまとめてtick
        for (let i = 0; i < elapsed; i++) {
          const state = pomodoroStore.getState()
          if (!state.isRunning) break
          if (state.timeRemaining <= 0) break
          state.tick()
        }
      }
      lastTickRef.current = Date.now()
    }

    // ストアを監視してインターバルを制御 + フェーズ遷移時にサウンド再生
    const unsub = pomodoroStore.subscribe((state) => {
      const prev = prevPhaseRef.current
      prevPhaseRef.current = state.phase

      // フェーズ遷移時にサウンドを再生
      if (state.phase !== prev) {
        if (state.phase === 'work') {
          playPhaseSound('work')
        } else if (state.phase === 'break') {
          playPhaseSound('break')
        }
      }

      if (state.isRunning) {
        startInterval()
      } else {
        stopInterval()
      }
    })

    // 初期状態チェック
    if (pomodoroStore.getState().isRunning) {
      startInterval()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopInterval()
      unsub()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
