import { useEffect, useRef } from 'react'
import homeStore from '@/features/stores/home'
import pomodoroStore from '@/features/stores/pomodoro'

const CHECK_INTERVAL = 5 * 60 * 1000 // 5分ごとに睡眠チェック
const SLEEP_PROBABILITY = 0.5 // 50%の確率で睡眠に入る
const AUTO_WAKE_DURATION = 5 * 60 * 1000 // 睡眠から5分で自動起床

export const useSleepMode = () => {
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearAllTimers = () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
    }

    const startAutoWakeTimer = () => {
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
      wakeTimerRef.current = setTimeout(() => {
        const { viewer, isSleeping } = homeStore.getState()
        if (isSleeping) {
          viewer?.model?.wakeUp()
          homeStore.setState({ isSleeping: false })
        }
        // 起床後、再び定期チェックを開始
        scheduleCheck()
      }, AUTO_WAKE_DURATION)
    }

    const scheduleCheck = () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
      checkTimerRef.current = setTimeout(() => {
        const { viewer, chatProcessing, isSleeping } = homeStore.getState()

        // 既に睡眠中 or チャット処理中 or ポモドーロ作業中なら次のチェックへ
        const pomodoroPhase = pomodoroStore.getState().phase
        if (isSleeping || chatProcessing || pomodoroPhase === 'work') {
          scheduleCheck()
          return
        }

        // ランダムで睡眠するかどうかを決定
        if (Math.random() < SLEEP_PROBABILITY && viewer?.model) {
          viewer.model.enterDrowsy()
          homeStore.setState({ isSleeping: true })
          startAutoWakeTimer()
        } else {
          // 今回は寝ない → 次のチェックをスケジュール
          scheduleCheck()
        }
      }, CHECK_INTERVAL)
    }

    const wakeAndReschedule = () => {
      // 睡眠中なら起こす
      const { viewer, isSleeping } = homeStore.getState()
      if (isSleeping) {
        viewer?.model?.wakeUp()
        homeStore.setState({ isSleeping: false })
        if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
      }

      // 定期チェックを再スケジュール（操作があったのでリセット）
      scheduleCheck()
    }

    // ユーザー操作イベントを監視
    const events = ['mousedown', 'keydown', 'touchstart'] as const
    events.forEach((event) => window.addEventListener(event, wakeAndReschedule))

    // chatProcessing変化を監視
    let prevProcessing = homeStore.getState().chatProcessing
    const unsub = homeStore.subscribe((state) => {
      if (state.chatProcessing && !prevProcessing) {
        wakeAndReschedule()
      }
      prevProcessing = state.chatProcessing
    })

    // 初期チェック開始
    scheduleCheck()

    return () => {
      clearAllTimers()
      events.forEach((event) =>
        window.removeEventListener(event, wakeAndReschedule)
      )
      unsub()
    }
  }, [])
}
