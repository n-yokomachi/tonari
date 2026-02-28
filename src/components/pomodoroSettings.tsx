import { useCallback, useRef } from 'react'
import pomodoroStore from '@/features/stores/pomodoro'
import settingsStore from '@/features/stores/settings'

interface PomodoroSettingsProps {
  onClose: () => void
  onResetLayout: () => void
}

interface ScrollNumberInputProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  unit: string
  label: string
}

const ScrollNumberInput = ({
  value,
  min,
  max,
  onChange,
  disabled,
  unit,
  label,
}: ScrollNumberInputProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const increment = useCallback(() => {
    if (!disabled && value < max) onChange(value + 1)
  }, [disabled, value, max, onChange])

  const decrement = useCallback(() => {
    if (!disabled && value > min) onChange(value - 1)
  }, [disabled, value, min, onChange])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return
      e.preventDefault()
      if (e.deltaY < 0) increment()
      else decrement()
    },
    [disabled, increment, decrement]
  )

  return (
    <div className={`${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[#5c4b7d] dark:text-[#c9b8e8] text-sm font-medium">
          {label}
        </span>
      </div>
      <div
        ref={containerRef}
        className="flex items-center justify-center gap-2 bg-[#5c4b7d]/[0.03] dark:bg-[#c9b8e8]/[0.06] rounded-xl py-2 px-3 group"
        onWheel={handleWheel}
      >
        <button
          onClick={decrement}
          disabled={disabled || value <= min}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#5c4b7d]/[0.06] dark:bg-[#c9b8e8]/[0.08] text-[#5c4b7d]/50 dark:text-[#c9b8e8]/50 hover:bg-[#5c4b7d]/15 dark:hover:bg-[#c9b8e8]/15 hover:text-[#5c4b7d] dark:hover:text-[#c9b8e8] active:bg-[#5c4b7d]/20 dark:active:bg-[#c9b8e8]/20 transition-all disabled:opacity-20 disabled:hover:bg-[#5c4b7d]/[0.06] dark:disabled:hover:bg-[#c9b8e8]/[0.08] text-lg select-none"
        >
          &#x25BC;
        </button>
        <div className="flex items-baseline justify-center w-28">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= min && val <= max) onChange(val)
            }}
            disabled={disabled}
            className="w-10 bg-transparent text-right text-[#5c4b7d] dark:text-[#c9b8e8] font-Montserrat text-2xl font-light disabled:opacity-40 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[#5c4b7d]/60 dark:text-[#c9b8e8]/60 text-xs font-Montserrat ml-1 w-14">
            {unit}
          </span>
        </div>
        <button
          onClick={increment}
          disabled={disabled || value >= max}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#5c4b7d]/[0.06] dark:bg-[#c9b8e8]/[0.08] text-[#5c4b7d]/50 dark:text-[#c9b8e8]/50 hover:bg-[#5c4b7d]/15 dark:hover:bg-[#c9b8e8]/15 hover:text-[#5c4b7d] dark:hover:text-[#c9b8e8] active:bg-[#5c4b7d]/20 dark:active:bg-[#c9b8e8]/20 transition-all disabled:opacity-20 disabled:hover:bg-[#5c4b7d]/[0.06] dark:disabled:hover:bg-[#c9b8e8]/[0.08] text-lg select-none"
        >
          &#x25B2;
        </button>
      </div>
    </div>
  )
}

export const PomodoroSettings = ({
  onClose,
  onResetLayout,
}: PomodoroSettingsProps) => {
  const workDuration = pomodoroStore((s) => s.workDuration)
  const breakDuration = pomodoroStore((s) => s.breakDuration)
  const totalSessions = pomodoroStore((s) => s.totalSessions)
  const autoStart = pomodoroStore((s) => s.autoStart)
  const showOverlay = pomodoroStore((s) => s.showOverlay)
  const overlayOpacity = pomodoroStore((s) => s.overlayOpacity)
  const volume = pomodoroStore((s) => s.volume)
  const phase = pomodoroStore((s) => s.phase)
  const isRunning = pomodoroStore((s) => s.isRunning)

  const isDark = settingsStore((s) => s.colorTheme === 'tonari-dark')

  const isTimerActive =
    isRunning ||
    (phase !== 'idle' && phase !== 'completed' && phase !== 'paused')

  return (
    <div
      className="rounded-2xl p-6 text-sm w-80"
      style={{
        backgroundColor: isDark
          ? 'rgba(20, 20, 35, 0.75)'
          : 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <span className="font-Montserrat font-light text-lg tracking-[0.1em] text-[#5c4b7d] dark:text-[#c9b8e8]">
          Settings
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[#5c4b7d]/40 dark:text-[#c9b8e8]/40 hover:text-[#5c4b7d] dark:hover:text-[#c9b8e8] hover:bg-[#5c4b7d]/10 dark:hover:bg-[#c9b8e8]/10 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <ScrollNumberInput
          value={Math.round(workDuration / 60)}
          min={1}
          max={120}
          onChange={(val) =>
            pomodoroStore.getState().updateSettings({ workDuration: val * 60 })
          }
          disabled={isTimerActive}
          unit="min"
          label="Work"
        />

        <ScrollNumberInput
          value={Math.round(breakDuration / 60)}
          min={1}
          max={60}
          onChange={(val) =>
            pomodoroStore.getState().updateSettings({ breakDuration: val * 60 })
          }
          disabled={isTimerActive}
          unit="min"
          label="Break"
        />

        <ScrollNumberInput
          value={totalSessions}
          min={1}
          max={12}
          onChange={(val) =>
            pomodoroStore.getState().updateSettings({ totalSessions: val })
          }
          disabled={isTimerActive}
          unit="sessions"
          label="Sessions"
        />

        <div className="border-t border-[#5c4b7d]/10 dark:border-[#c9b8e8]/10 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#5c4b7d] dark:text-[#c9b8e8] text-sm font-medium">
              Auto Start
            </span>
            <button
              onClick={() => {
                pomodoroStore.getState().updateSettings({
                  autoStart: !autoStart,
                })
              }}
              className={`w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                autoStart
                  ? 'bg-[#5c4b7d] dark:bg-[#c9b8e8]'
                  : 'bg-[#5c4b7d]/15 dark:bg-[#c9b8e8]/15'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 my-1 shadow-sm ${
                  autoStart ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#5c4b7d] dark:text-[#c9b8e8] text-sm font-medium">
              Overlay
            </span>
            <button
              onClick={() => {
                pomodoroStore.getState().updateSettings({
                  showOverlay: !showOverlay,
                })
              }}
              className={`w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                showOverlay
                  ? 'bg-[#5c4b7d] dark:bg-[#c9b8e8]'
                  : 'bg-[#5c4b7d]/15 dark:bg-[#c9b8e8]/15'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 my-1 shadow-sm ${
                  showOverlay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div
            className={`${!showOverlay ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#5c4b7d] dark:text-[#c9b8e8] text-sm font-medium">
                Opacity
              </span>
              <span className="text-[#5c4b7d]/60 dark:text-[#c9b8e8]/60 text-xs font-Montserrat">
                {overlayOpacity}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={overlayOpacity}
              onChange={(e) => {
                pomodoroStore.getState().updateSettings({
                  overlayOpacity: parseInt(e.target.value, 10),
                })
              }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#5c4b7d]/15 dark:bg-[#c9b8e8]/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#5c4b7d] dark:[&::-webkit-slider-thumb]:bg-[#c9b8e8] [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#5c4b7d] dark:[&::-moz-range-thumb]:bg-[#c9b8e8] [&::-moz-range-thumb]:border-0"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#5c4b7d] dark:text-[#c9b8e8] text-sm font-medium">
                Volume
              </span>
              <span className="text-[#5c4b7d]/60 dark:text-[#c9b8e8]/60 text-xs font-Montserrat">
                {volume}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                pomodoroStore.getState().updateSettings({
                  volume: parseInt(e.target.value, 10),
                })
              }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#5c4b7d]/15 dark:bg-[#c9b8e8]/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#5c4b7d] dark:[&::-webkit-slider-thumb]:bg-[#c9b8e8] [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#5c4b7d] dark:[&::-moz-range-thumb]:bg-[#c9b8e8] [&::-moz-range-thumb]:border-0"
            />
          </div>

          <button
            onClick={onResetLayout}
            className="w-full py-2 rounded-xl text-[#5c4b7d]/50 dark:text-[#c9b8e8]/50 text-xs hover:text-[#5c4b7d] dark:hover:text-[#c9b8e8] hover:bg-[#5c4b7d]/[0.06] dark:hover:bg-[#c9b8e8]/[0.06] active:bg-[#5c4b7d]/10 dark:active:bg-[#c9b8e8]/10 transition-colors"
          >
            Reset Position & Size
          </button>
        </div>
      </div>
    </div>
  )
}
