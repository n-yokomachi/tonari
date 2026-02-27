import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PomodoroPhase = 'idle' | 'work' | 'break' | 'paused' | 'completed'

interface PomodoroSettings {
  workDuration: number // 秒単位（デフォルト: 1500 = 25分）
  breakDuration: number // 秒単位（デフォルト: 300 = 5分）
  totalSessions: number // 目標セッション数（デフォルト: 4）
  autoStart: boolean // 自動開始（デフォルト: true）
  showOverlay: boolean // タイマー背景オーバーレイ（デフォルト: false）
  overlayOpacity: number // オーバーレイ不透明度 0-100（デフォルト: 35）
  volume: number // 音量 0-100（デフォルト: 50）
}

interface PomodoroTimerState {
  phase: PomodoroPhase
  timeRemaining: number // 秒単位
  isRunning: boolean
  completedSessions: number
  previousPhase: PomodoroPhase // paused時に元のphaseを保持
}

interface PomodoroActions {
  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  stop: () => void
  toggle: () => void
  tick: () => void
  updateSettings: (settings: Partial<PomodoroSettings>) => void
}

export type PomodoroState = PomodoroSettings &
  PomodoroTimerState &
  PomodoroActions

const DEFAULT_WORK_DURATION = 25 * 60
const DEFAULT_BREAK_DURATION = 5 * 60
const DEFAULT_TOTAL_SESSIONS = 4
const MIN_DURATION = 60 // 最小1分

const pomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      // 設定（永続化対象）
      workDuration: DEFAULT_WORK_DURATION,
      breakDuration: DEFAULT_BREAK_DURATION,
      totalSessions: DEFAULT_TOTAL_SESSIONS,
      autoStart: true,
      showOverlay: false,
      overlayOpacity: 35,
      volume: 50,

      // タイマー状態（transient）
      phase: 'idle' as PomodoroPhase,
      timeRemaining: DEFAULT_WORK_DURATION,
      isRunning: false,
      completedSessions: 0,
      previousPhase: 'idle' as PomodoroPhase,

      start: () => {
        const { workDuration } = get()
        set({
          phase: 'work',
          timeRemaining: workDuration,
          isRunning: true,
          completedSessions: 0,
          previousPhase: 'idle',
        })
      },

      pause: () => {
        const { phase } = get()
        if (phase === 'work' || phase === 'break') {
          set({
            previousPhase: phase,
            phase: 'paused',
            isRunning: false,
          })
        }
      },

      resume: () => {
        const { previousPhase } = get()
        if (previousPhase === 'work' || previousPhase === 'break') {
          set({
            phase: previousPhase,
            isRunning: true,
          })
        }
      },

      skip: () => {
        const { phase, previousPhase, completedSessions, totalSessions } = get()
        const currentPhase = phase === 'paused' ? previousPhase : phase

        if (currentPhase === 'work') {
          // 作業→休憩（セッションカウントをインクリメント）
          const newCompleted = completedSessions + 1
          if (newCompleted >= totalSessions) {
            set({
              phase: 'completed',
              isRunning: false,
              completedSessions: newCompleted,
              previousPhase: 'idle',
            })
          } else {
            const { breakDuration, autoStart } = get()
            set({
              phase: autoStart ? 'break' : 'paused',
              previousPhase: autoStart ? 'break' : 'break',
              timeRemaining: breakDuration,
              isRunning: autoStart,
              completedSessions: newCompleted,
            })
          }
        } else if (currentPhase === 'break') {
          // 休憩→作業
          const { workDuration, autoStart } = get()
          set({
            phase: autoStart ? 'work' : 'paused',
            previousPhase: autoStart ? 'work' : 'work',
            timeRemaining: workDuration,
            isRunning: autoStart,
          })
        }
      },

      stop: () => {
        const { workDuration } = get()
        set({
          phase: 'paused',
          previousPhase: 'idle',
          timeRemaining: workDuration,
          isRunning: false,
          completedSessions: 0,
        })
      },

      toggle: () => {
        const { phase, workDuration } = get()
        if (phase === 'idle') {
          // タイマー表示（自動再生しない）
          set({
            phase: 'paused',
            previousPhase: 'idle',
            timeRemaining: workDuration,
            isRunning: false,
            completedSessions: 0,
          })
        } else {
          set({
            phase: 'idle',
            timeRemaining: workDuration,
            isRunning: false,
            completedSessions: 0,
            previousPhase: 'idle',
          })
        }
      },

      tick: () => {
        const { timeRemaining, phase, isRunning } = get()
        if (!isRunning || (phase !== 'work' && phase !== 'break')) return

        const newTime = timeRemaining - 1
        if (newTime <= 0) {
          // フェーズ遷移
          if (phase === 'work') {
            const {
              completedSessions,
              totalSessions,
              breakDuration,
              autoStart,
            } = get()
            const newCompleted = completedSessions + 1
            if (newCompleted >= totalSessions) {
              set({
                phase: 'completed',
                timeRemaining: 0,
                isRunning: false,
                completedSessions: newCompleted,
                previousPhase: 'idle',
              })
            } else {
              set({
                phase: autoStart ? 'break' : 'paused',
                previousPhase: autoStart ? 'break' : 'break',
                timeRemaining: breakDuration,
                isRunning: autoStart,
                completedSessions: newCompleted,
              })
            }
          } else {
            // break → work
            const { workDuration, autoStart } = get()
            set({
              phase: autoStart ? 'work' : 'paused',
              previousPhase: autoStart ? 'work' : 'work',
              timeRemaining: workDuration,
              isRunning: autoStart,
            })
          }
        } else {
          set({ timeRemaining: newTime })
        }
      },

      updateSettings: (settings: Partial<PomodoroSettings>) => {
        const validated: Partial<PomodoroSettings> = {}
        if (settings.workDuration !== undefined) {
          validated.workDuration = Math.max(settings.workDuration, MIN_DURATION)
        }
        if (settings.breakDuration !== undefined) {
          validated.breakDuration = Math.max(
            settings.breakDuration,
            MIN_DURATION
          )
        }
        if (settings.totalSessions !== undefined) {
          validated.totalSessions = Math.max(settings.totalSessions, 1)
        }
        if (settings.autoStart !== undefined) {
          validated.autoStart = settings.autoStart
        }
        if (settings.showOverlay !== undefined) {
          validated.showOverlay = settings.showOverlay
        }
        if (settings.overlayOpacity !== undefined) {
          validated.overlayOpacity = Math.max(
            0,
            Math.min(100, settings.overlayOpacity)
          )
        }
        if (settings.volume !== undefined) {
          validated.volume = Math.max(0, Math.min(100, settings.volume))
        }
        set(validated)

        // 停止中（paused + previousPhase=idle）はtimeRemainingも同期
        const { phase, previousPhase } = get()
        if (phase === 'paused' && previousPhase === 'idle') {
          if (validated.workDuration !== undefined) {
            set({ timeRemaining: validated.workDuration })
          }
        }
      },
    }),
    {
      name: 'tonari-pomodoro',
      partialize: (state) => ({
        workDuration: state.workDuration,
        breakDuration: state.breakDuration,
        totalSessions: state.totalSessions,
        autoStart: state.autoStart,
        showOverlay: state.showOverlay,
        overlayOpacity: state.overlayOpacity,
        volume: state.volume,
      }),
    }
  )
)

export default pomodoroStore
