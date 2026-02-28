import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import pomodoroStore, { PomodoroPhase } from '@/features/stores/pomodoro'
import settingsStore from '@/features/stores/settings'
import { getNextPanelZ } from '@/utils/panelZIndex'
import { CircularProgress } from './circularProgress'
import { PomodoroSettings } from './pomodoroSettings'

const SECONDARY = '#5c4b7d'
const BREAK_COLOR = '#8b7aab'
const ACTIVE_SESSION_COLOR = '#cc3355'

const ICON_FILTER_LIGHT =
  'brightness(0) saturate(100%) invert(30%) sepia(15%) saturate(1200%) hue-rotate(230deg)'
const ICON_FILTER_DARK =
  'brightness(0) saturate(100%) invert(70%) sepia(15%) saturate(800%) hue-rotate(230deg)'

const STORAGE_KEY = 'tonari-pomodoro-layout'
const BASE_SIZE = 180
const MIN_SCALE = 0.5
const MAX_SCALE = 1.5
const FADE_DURATION = 300

interface TimerLayout {
  x: number
  y: number
  scale: number
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const getPhaseColor = (phase: PomodoroPhase, previousPhase: PomodoroPhase) => {
  const effectivePhase = phase === 'paused' ? previousPhase : phase
  return effectivePhase === 'break' ? BREAK_COLOR : SECONDARY
}

const getPhaseLabel = (phase: PomodoroPhase, previousPhase: PomodoroPhase) => {
  if (phase === 'paused') {
    if (previousPhase === 'idle') return 'STOP'
    const base = previousPhase === 'break' ? 'BREAK' : 'WORK'
    return `${base} - PAUSED`
  }
  if (phase === 'work') return 'WORK'
  if (phase === 'break') return 'BREAK'
  if (phase === 'completed') return 'DONE'
  return ''
}

const loadLayout = (): TimerLayout | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

const saveLayout = (layout: TimerLayout) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {}
}

const clearLayout = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('tonari-pomodoro-position')
  } catch {}
}

export const PomodoroTimer = () => {
  const phase = pomodoroStore((s) => s.phase)
  const timeRemaining = pomodoroStore((s) => s.timeRemaining)
  const completedSessions = pomodoroStore((s) => s.completedSessions)
  const totalSessions = pomodoroStore((s) => s.totalSessions)
  const workDuration = pomodoroStore((s) => s.workDuration)
  const breakDuration = pomodoroStore((s) => s.breakDuration)
  const previousPhase = pomodoroStore((s) => s.previousPhase)
  const isRunning = pomodoroStore((s) => s.isRunning)
  const showOverlay = pomodoroStore((s) => s.showOverlay)
  const overlayOpacity = pomodoroStore((s) => s.overlayOpacity)
  const isDark = settingsStore((s) => s.colorTheme === 'tonari-dark')

  const [showSettings, setShowSettings] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerMounted, setTimerMounted] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  )
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [zIndex, setZIndex] = useState(25)
  const dragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)
  const resizeRef = useRef<{
    startX: number
    startY: number
    origScale: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const orientationRef = useRef<'portrait' | 'landscape'>('landscape')

  const isActive = phase !== 'idle'

  // タイマーのフェードイン/アウト
  useEffect(() => {
    if (isActive) {
      setTimerMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimerVisible(true))
      })
    } else {
      setTimerVisible(false)
      const timer = setTimeout(() => setTimerMounted(false), FADE_DURATION)
      return () => clearTimeout(timer)
    }
  }, [isActive])

  // 設定パネルのフェードイン/アウト
  const openSettings = useCallback(() => {
    setShowSettings(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSettingsVisible(true))
    })
  }, [])

  const closeSettings = useCallback(() => {
    setSettingsVisible(false)
    const timer = setTimeout(() => setShowSettings(false), FADE_DURATION)
    return () => clearTimeout(timer)
  }, [])

  // 初期化: レイアウト読み込み & 画面方向の検出
  useEffect(() => {
    const saved = loadLayout()
    if (saved) {
      setPosition({ x: saved.x, y: saved.y })
      setScale(saved.scale)
    }
    orientationRef.current =
      window.innerWidth < window.innerHeight ? 'portrait' : 'landscape'
  }, [])

  // 画面リサイズ（方向変更）を監視してリセット
  useEffect(() => {
    const handleResize = () => {
      const newOrientation =
        window.innerWidth < window.innerHeight ? 'portrait' : 'landscape'
      if (newOrientation !== orientationRef.current) {
        orientationRef.current = newOrientation
        setPosition(null)
        setScale(1)
        clearLayout()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const clampPosition = useCallback((x: number, y: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      x: Math.max(0, Math.min(x, vw - w)),
      y: Math.max(0, Math.min(y, vh - h)),
    }
  }, [])

  const bringToFront = useCallback(() => {
    setZIndex(getNextPanelZ())
  }, [])

  // ドラッグ（移動）
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    bringToFront()
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      moved: false,
    }
    setIsDragging(true)
    el.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (!dragRef.current.moved && Math.abs(dx) + Math.abs(dy) < 5) return
      dragRef.current.moved = true
      const newPos = clampPosition(
        dragRef.current.origX + dx,
        dragRef.current.origY + dy
      )
      setPosition(newPos)
    },
    [clampPosition]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      if (dragRef.current.moved && position) {
        saveLayout({ x: position.x, y: position.y, scale })
      }
      dragRef.current = null
      setIsDragging(false)
      const el = containerRef.current
      if (el) el.releasePointerCapture(e.pointerId)
    },
    [position, scale]
  )

  // リサイズ
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origScale: scale,
      }
      setIsResizing(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [scale]
  )

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return
    const dx = e.clientX - resizeRef.current.startX
    const dy = e.clientY - resizeRef.current.startY
    const delta = (dx + dy) / 200
    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, resizeRef.current.origScale + delta)
    )
    setScale(newScale)
  }, [])

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return
      resizeRef.current = null
      setIsResizing(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      const pos = position || {
        x: window.innerWidth - BASE_SIZE * scale - 16,
        y: 16,
      }
      saveLayout({ x: pos.x, y: pos.y, scale })
    },
    [position, scale]
  )

  if (!timerMounted) return null

  const effectivePhase = phase === 'paused' ? previousPhase : phase
  const totalDuration =
    effectivePhase === 'break' ? breakDuration : workDuration
  const progress = phase === 'completed' ? 1 : 1 - timeRemaining / totalDuration
  const color = getPhaseColor(phase, previousPhase)

  const handlePlayPause = () => {
    if (isRunning) {
      pomodoroStore.getState().pause()
    } else if (previousPhase === 'idle') {
      pomodoroStore.getState().start()
    } else {
      pomodoroStore.getState().resume()
    }
  }

  const positionStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y, right: 'auto' }
    : { top: 16, right: 16 }

  const circleSize = Math.round(BASE_SIZE * scale)
  const iconSize = Math.round(22 * scale)
  const showHandle = isHovered && !isDragging
  const iconFilter = isDark ? ICON_FILTER_DARK : ICON_FILTER_LIGHT

  return (
    <>
      <div
        ref={containerRef}
        className="fixed flex flex-col items-center gap-3 pointer-events-auto touch-none select-none group rounded-3xl"
        style={{
          ...positionStyle,
          zIndex,
          cursor: isDragging ? 'grabbing' : 'grab',
          padding: showOverlay ? 20 : 0,
          backgroundColor: showOverlay
            ? isDark
              ? `rgba(20, 20, 35, ${overlayOpacity / 100})`
              : `rgba(255, 255, 255, ${overlayOpacity / 100})`
            : 'transparent',
          backdropFilter: showOverlay ? 'blur(20px) saturate(1.4)' : 'none',
          WebkitBackdropFilter: showOverlay
            ? 'blur(20px) saturate(1.4)'
            : 'none',
          border: showOverlay
            ? isDark
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(255, 255, 255, 0.5)'
            : 'none',
          boxShadow: showOverlay
            ? isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
            : 'none',
          opacity: timerVisible ? 1 : 0,
          transition: `opacity ${FADE_DURATION}ms ease`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isResizing) setIsHovered(false)
        }}
      >
        {/* 円形タイマー */}
        <CircularProgress
          progress={progress}
          size={circleSize}
          strokeWidth={Math.max(2, Math.round(4 * scale))}
          color={color}
          backgroundColor="rgba(92, 75, 125, 0.12)"
        >
          <div className="flex flex-col items-center">
            <span
              className="font-light tracking-[0.08em] font-Montserrat"
              style={{ color, fontSize: Math.round(36 * scale) }}
            >
              {phase === 'completed' ? '✓' : formatTime(timeRemaining)}
            </span>
            <span
              className="tracking-[0.15em] font-Montserrat font-light mt-1"
              style={{
                color,
                opacity: 0.6,
                fontSize: Math.round(10 * scale),
              }}
            >
              {getPhaseLabel(phase, previousPhase)}
            </span>
          </div>
        </CircularProgress>

        {/* セッションカウント */}
        <div className="flex gap-2">
          {Array.from({ length: totalSessions }, (_, i) => {
            const isCompleted = i < completedSessions
            const isActive =
              i === completedSessions &&
              phase !== 'completed' &&
              (phase === 'work' ||
                (phase === 'paused' && previousPhase === 'work'))
            const dotSize = Math.round(10 * scale)
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: dotSize,
                  height: dotSize,
                  backgroundColor: isActive
                    ? ACTIVE_SESSION_COLOR
                    : isCompleted
                      ? color
                      : 'rgba(92,75,125,0.15)',
                  boxShadow: isActive
                    ? `0 0 6px ${ACTIVE_SESSION_COLOR}60`
                    : 'none',
                }}
              />
            )
          })}
        </div>

        {/* 操作ボタン */}
        <div className="flex gap-3 items-center">
          {phase === 'completed' ? (
            <button
              onClick={() => pomodoroStore.getState().stop()}
              className="text-sm px-5 py-2 rounded-full font-Montserrat font-light tracking-wider transition-all duration-200 hover:opacity-80"
              style={{
                color: SECONDARY,
                border: '1px solid rgba(92,75,125,0.3)',
              }}
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={handlePlayPause}
                className="rounded-full p-2.5 transition-all duration-200 hover:bg-[#5c4b7d]/10"
                aria-label={isRunning ? '一時停止' : '再開'}
              >
                <Image
                  src={
                    isRunning
                      ? '/images/icons/pause.svg'
                      : '/images/icons/play.svg'
                  }
                  alt={isRunning ? '一時停止' : '再開'}
                  width={iconSize}
                  height={iconSize}
                  style={{ filter: iconFilter }}
                />
              </button>

              <button
                onClick={() => {
                  if (isRunning) pomodoroStore.getState().skip()
                }}
                className={`rounded-full p-2.5 transition-all duration-200 ${
                  isRunning
                    ? 'hover:bg-[#5c4b7d]/10 cursor-pointer'
                    : 'opacity-25 cursor-default'
                }`}
                aria-label="スキップ"
                aria-disabled={!isRunning}
              >
                <Image
                  src="/images/icons/next.svg"
                  alt="スキップ"
                  width={iconSize}
                  height={iconSize}
                  style={{ filter: iconFilter }}
                />
              </button>

              <button
                onClick={() => pomodoroStore.getState().stop()}
                className="rounded-full p-2.5 transition-all duration-200 hover:bg-[#5c4b7d]/10"
                aria-label="リセット"
              >
                <Image
                  src="/images/icons/stop.svg"
                  alt="リセット"
                  width={iconSize}
                  height={iconSize}
                  style={{ filter: iconFilter }}
                />
              </button>

              <button
                onClick={() => {
                  if (!isRunning) openSettings()
                }}
                className={`rounded-full p-2.5 transition-all duration-200 ${
                  isRunning
                    ? 'opacity-25 cursor-default'
                    : 'hover:bg-[#5c4b7d]/10 cursor-pointer'
                }`}
                aria-label="設定"
                aria-disabled={isRunning}
              >
                <Image
                  src="/images/icons/settings.svg"
                  alt="設定"
                  width={iconSize}
                  height={iconSize}
                  style={{ filter: iconFilter }}
                />
              </button>
            </>
          )}
        </div>

        {/* リサイズハンドル（右下、ホバー時のみ表示） */}
        <div
          data-resize-handle
          className="absolute bottom-0 right-0 transition-opacity duration-200"
          style={{
            opacity: showHandle || isResizing ? 1 : 0,
            pointerEvents: showHandle || isResizing ? 'auto' : 'none',
            cursor: 'nwse-resize',
          }}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2L2 14M14 6L6 14M14 10L10 14"
              stroke={isDark ? '#9d8dbd' : '#5c4b7d'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.4"
            />
          </svg>
        </div>
      </div>

      {/* 設定パネル（フルスクリーンオーバーレイ） */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[30] flex items-center justify-center"
          style={{
            backgroundColor: settingsVisible
              ? 'rgba(0, 0, 0, 0.1)'
              : 'transparent',
            transition: `background-color ${FADE_DURATION}ms ease`,
          }}
          onClick={closeSettings}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              opacity: settingsVisible ? 1 : 0,
              transform: settingsVisible
                ? 'scale(1) translateY(0)'
                : 'scale(0.95) translateY(8px)',
              transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
            }}
          >
            <PomodoroSettings
              onClose={closeSettings}
              onResetLayout={() => {
                localStorage.removeItem(STORAGE_KEY)
                setPosition(null)
                setScale(1)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
