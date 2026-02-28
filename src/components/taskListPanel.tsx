import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import taskStore, { Task } from '@/features/stores/tasks'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { getNextPanelZ } from '@/utils/panelZIndex'

const STORAGE_KEY = 'tonari-task-layout'
const FADE_DURATION = 300
const BASE_WIDTH = 320
const MIN_SCALE = 0.7
const MAX_SCALE = 1.5

const ICON_FILTER_LIGHT =
  'brightness(0) saturate(100%) invert(30%) sepia(15%) saturate(1200%) hue-rotate(230deg)'
const ICON_FILTER_DARK =
  'brightness(0) saturate(100%) invert(70%) sepia(15%) saturate(800%) hue-rotate(230deg)'

// Color palette per theme
const colors = (dark: boolean) => ({
  accent: dark ? '#c9b8e8' : '#5c4b7d',
  accentSub: dark ? '#9d8dbd' : '#5c4b7d',
  text: dark ? '#e0dcd6' : '#3a3050',
  textMuted: dark ? 'rgba(201,184,232,0.5)' : 'rgba(92,75,125,0.5)',
  textFaint: dark ? 'rgba(201,184,232,0.3)' : 'rgba(92,75,125,0.3)',
  panelBg: dark ? 'rgba(20, 20, 35, 0.55)' : 'rgba(255, 255, 255, 0.55)',
  panelBorder: dark
    ? '1px solid rgba(255, 255, 255, 0.1)'
    : '1px solid rgba(255, 255, 255, 0.5)',
  panelShadow: dark
    ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
    : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
  calBg: dark ? 'rgba(20, 20, 35, 0.75)' : 'rgba(255, 255, 255, 0.6)',
  calBorder: dark
    ? '1px solid rgba(255, 255, 255, 0.1)'
    : '1px solid rgba(255, 255, 255, 0.6)',
  calShadow: dark
    ? '0 12px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
    : '0 12px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
  checkboxBorder: dark ? 'rgba(201,184,232,0.4)' : 'rgba(92,75,125,0.4)',
  checkboxHoverBorder: dark ? '#c9b8e8' : '#5c4b7d',
  checkboxHoverBg: dark ? 'rgba(201,184,232,0.1)' : 'rgba(92,75,125,0.1)',
  completedBg: dark ? 'rgba(201,184,232,0.2)' : 'rgba(92,75,125,0.2)',
  divider: dark ? 'rgba(201,184,232,0.12)' : 'rgba(92,75,125,0.12)',
  hoverBg: dark ? 'rgba(201,184,232,0.1)' : 'rgba(92,75,125,0.1)',
  todayBg: dark ? 'rgba(201,184,232,0.15)' : 'rgba(92,75,125,0.12)',
  selectedBg: dark ? '#c9b8e8' : '#5c4b7d',
  selectedText: dark ? '#1a1a2e' : '#fff',
})

interface PanelLayout {
  x: number
  y: number
  scale: number
}

const loadLayout = (): PanelLayout | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { x: parsed.x, y: parsed.y, scale: parsed.scale ?? 1 }
    }
  } catch {}
  return null
}

const saveLayout = (layout: PanelLayout) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {}
}

const clearLayout = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate + 'T00:00:00')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function getDueDateStatus(
  dueDate: string | null
): 'none' | 'normal' | 'urgent' | 'overdue' {
  if (!dueDate) return 'none'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.floor(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'urgent'
  return 'normal'
}

// MiniCalendar sub-component (portal-rendered, smart up/down positioning)
const MiniCalendar = ({
  selectedDate,
  onSelect,
  onClose,
  anchorRect,
  isDark,
}: {
  selectedDate: string | null
  onSelect: (date: string) => void
  onClose: () => void
  anchorRect: DOMRect
  isDark: boolean
}) => {
  const c = colors(isDark)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewYear, setViewYear] = useState(
    selectedDate
      ? new Date(selectedDate + 'T00:00:00').getFullYear()
      : today.getFullYear()
  )
  const [viewMonth, setViewMonth] = useState(
    selectedDate
      ? new Date(selectedDate + 'T00:00:00').getMonth()
      : today.getMonth()
  )
  const calRef = useRef<HTMLDivElement>(null)
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    opacity: 0,
  })

  useEffect(() => {
    const calHeight = calRef.current?.offsetHeight || 300
    const calWidth = 240
    const spaceBelow = window.innerHeight - anchorRect.bottom

    const style: React.CSSProperties = {
      position: 'fixed',
      left: Math.max(
        8,
        Math.min(anchorRect.left, window.innerWidth - calWidth - 8)
      ),
      opacity: 1,
      transition: 'opacity 0.15s ease',
    }

    if (spaceBelow >= calHeight + 8) {
      style.top = anchorRect.bottom + 4
    } else {
      style.bottom = window.innerHeight - anchorRect.top + 4
    }

    setPosStyle(style)
  }, [anchorRect])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const formatDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return (
    <div
      ref={calRef}
      className="z-[100]"
      style={{
        ...posStyle,
        backgroundColor: c.calBg,
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        border: c.calBorder,
        boxShadow: c.calShadow,
        borderRadius: '14px',
        padding: '12px',
        width: '240px',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          style={{ '--tw-bg-opacity': 1 } as React.CSSProperties}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = c.hoverBg)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'transparent')
          }
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 8 8"
            fill="none"
            stroke={c.accent}
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M5 1L2 4l3 3" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold" style={{ color: c.accent }}>
          {viewYear}年{viewMonth + 1}月
        </span>
        <button
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = c.hoverBg)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'transparent')
          }
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 8 8"
            fill="none"
            stroke={c.accent}
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 1l3 3-3 3" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold"
            style={{ color: c.accent, opacity: 0.45 }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const dateStr = formatDateStr(day)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className="w-full aspect-square flex items-center justify-center rounded-full text-[12px] transition-colors"
              style={{
                color: isSelected ? c.selectedText : c.text,
                backgroundColor: isSelected
                  ? c.selectedBg
                  : isToday
                    ? c.todayBg
                    : 'transparent',
                fontWeight: isToday || isSelected ? 600 : 400,
              }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Clear button */}
      {selectedDate && (
        <button
          onClick={() => onSelect('')}
          className="w-full mt-2.5 text-[11px] py-1.5 rounded-lg transition-colors"
          style={{ color: c.accent }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = c.hoverBg)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'transparent')
          }
        >
          期限をクリア
        </button>
      )}
    </div>
  )
}

export const TaskListPanel = () => {
  const isVisible = taskStore((s) => s.isVisible)
  const tasks = taskStore((s) => s.tasks)
  const completedTasks = taskStore((s) => s.completedTasks)
  const showCompleted = taskStore((s) => s.showCompleted)
  const loading = taskStore((s) => s.loading)
  const isDark = settingsStore((s) => s.colorTheme === 'tonari-dark')

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  )
  const [isDragging, setIsDragging] = useState(false)
  const [scale, setScale] = useState(1)
  const [isHovered, setIsHovered] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [zIndex, setZIndex] = useState(25)

  // Calendar popover (stores anchor rect for portal positioning)
  const [calendarAnchor, setCalendarAnchor] = useState<{
    taskId: string
    rect: DOMRect
  } | null>(null)

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Drag reorder
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const orientationRef = useRef<'portrait' | 'landscape'>('landscape')
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

  // Fetch tasks on mount
  useEffect(() => {
    taskStore.getState().fetchTasks()
  }, [])

  // Fade in/out
  useEffect(() => {
    if (isVisible) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), FADE_DURATION)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // Load saved layout (position + scale) and detect orientation
  useEffect(() => {
    const saved = loadLayout()
    if (saved) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.round(BASE_WIDTH * (saved.scale ?? 1))
      setPosition({
        x: Math.max(0, Math.min(saved.x, vw - w)),
        y: Math.max(0, Math.min(saved.y, vh - 100)),
      })
      setScale(saved.scale)
    }
    orientationRef.current =
      window.innerWidth < window.innerHeight ? 'portrait' : 'landscape'
  }, [])

  // Reset position on orientation change
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

  // Focus add input
  useEffect(() => {
    if (addingTask && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [addingTask])

  // Focus edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

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

  // Panel drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      bringToFront()
      if ((e.target as HTMLElement).closest('button')) return
      if ((e.target as HTMLElement).closest('input')) return
      if ((e.target as HTMLElement).closest('[data-task-item]')) return
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
    },
    [bringToFront]
  )

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

  // Resize handlers
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
        x: window.innerWidth - BASE_WIDTH * scale - 16,
        y: 16,
      }
      saveLayout({ x: pos.x, y: pos.y, scale })
    },
    [position, scale]
  )

  // Task actions
  const handleComplete = useCallback(async (taskId: string) => {
    await taskStore.getState().completeTask(taskId)
    const { viewer } = homeStore.getState()
    viewer?.model?.playGesture('cheer', { holdDuration: 3.0 })
  }, [])

  const handleStartEdit = useCallback((task: Task) => {
    setEditingId(task.taskId)
    setEditText(task.title)
  }, [])

  const handleFinishEdit = useCallback(async () => {
    if (editingId && editText.trim()) {
      await taskStore
        .getState()
        .updateTask(editingId, { title: editText.trim() })
    }
    setEditingId(null)
    setEditText('')
  }, [editingId, editText])

  const handleAddTask = useCallback(async () => {
    if (newTaskText.trim()) {
      await taskStore.getState().addTask(newTaskText.trim())
      setNewTaskText('')
      setAddingTask(false)
    }
  }, [newTaskText])

  const handleDueDate = useCallback(async (taskId: string, date: string) => {
    await taskStore.getState().updateTask(taskId, { dueDate: date || null })
    setCalendarAnchor(null)
  }, [])

  const openCalendar = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation()
      if (calendarAnchor?.taskId === taskId) {
        setCalendarAnchor(null)
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setCalendarAnchor({ taskId, rect })
      }
    },
    [calendarAnchor]
  )

  // Task reorder by drag
  const handleTaskDragStart = useCallback(
    (e: React.PointerEvent, taskId: string) => {
      e.stopPropagation()
      setDragItemId(taskId)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
  )

  const handleTaskDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragItemId) return
      const el = (e.target as HTMLElement).closest('[data-task-list]')
      if (!el) return
      const items = el.querySelectorAll('[data-task-item]')
      let overIdx = tasks.length - 1
      items.forEach((item, idx) => {
        const rect = item.getBoundingClientRect()
        if (e.clientY < rect.top + rect.height / 2) {
          if (overIdx >= idx) overIdx = idx
        }
      })
      setDragOverIndex(overIdx)
    },
    [dragItemId, tasks.length]
  )

  const handleTaskDragEnd = useCallback(async () => {
    if (dragItemId && dragOverIndex !== null) {
      const currentIndex = tasks.findIndex((t) => t.taskId === dragItemId)
      if (currentIndex !== -1 && currentIndex !== dragOverIndex) {
        const newTasks = [...tasks]
        const [moved] = newTasks.splice(currentIndex, 1)
        newTasks.splice(dragOverIndex, 0, moved)
        await taskStore.getState().reorderTasks(newTasks.map((t) => t.taskId))
      }
    }
    setDragItemId(null)
    setDragOverIndex(null)
  }, [dragItemId, dragOverIndex, tasks])

  if (!mounted) return null

  const c = colors(isDark)
  const showHandle = isHovered && !isDragging
  const panelWidth = Math.round(BASE_WIDTH * scale)
  const s = (v: number) => Math.round(v * scale)
  const iconFilter = isDark ? ICON_FILTER_DARK : ICON_FILTER_LIGHT

  const posStyle: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y }
    : { position: 'fixed', top: 16, right: 16 }

  // Find the task for calendar (if open)
  const calendarTask = calendarAnchor
    ? tasks.find((t) => t.taskId === calendarAnchor.taskId)
    : null

  return (
    <>
      <div
        ref={containerRef}
        style={{
          ...posStyle,
          zIndex,
          width: panelWidth,
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_DURATION}ms ease`,
          cursor: isDragging ? 'grabbing' : 'grab',
          backgroundColor: c.panelBg,
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: c.panelBorder,
          boxShadow: c.panelShadow,
          borderRadius: s(16),
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isResizing) setIsHovered(false)
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingLeft: s(16),
            paddingRight: s(16),
            paddingTop: s(14),
            paddingBottom: s(10),
          }}
        >
          <div className="flex items-center" style={{ gap: s(8) }}>
            <Image
              src="/images/icons/tasks.svg"
              alt="Tasks"
              width={s(18)}
              height={s(18)}
              unoptimized
              style={{ filter: iconFilter }}
            />
            <span
              className="font-semibold tracking-wider"
              style={{ color: c.accent, fontSize: s(13) }}
            >
              TASKS
            </span>
          </div>
          <div className="flex items-center" style={{ gap: s(4) }}>
            {/* Completed tasks toggle */}
            <button
              onClick={() => taskStore.getState().toggleShowCompleted()}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{ width: s(28), height: s(28) }}
              title={showCompleted ? '完了タスクを非表示' : '完了タスクを表示'}
            >
              <svg
                width={s(12)}
                height={s(12)}
                viewBox="0 0 12 12"
                fill="none"
                stroke={c.accent}
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{
                  transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <path d="M4 2l4 4-4 4" />
              </svg>
            </button>
            {/* Reload button */}
            <button
              onClick={() => taskStore.getState().fetchTasks()}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{ width: s(28), height: s(28) }}
              title="タスクを再読み込み"
            >
              <svg
                width={s(12)}
                height={s(12)}
                viewBox="0 0 16 16"
                fill="none"
                stroke={c.accent}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 1v5h5" />
                <path d="M3.5 10a6 6 0 1 0 1.2-6.2L1 6" />
              </svg>
            </button>
            {/* Add button */}
            <button
              onClick={() => setAddingTask(true)}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{ width: s(28), height: s(28) }}
              title="タスクを追加"
            >
              <svg
                width={s(12)}
                height={s(12)}
                viewBox="0 0 12 12"
                fill="none"
                stroke={c.accent}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="6" y1="1" x2="6" y2="11" />
                <line x1="1" y1="6" x2="11" y2="6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Task List */}
        <div
          className="overflow-y-auto"
          style={{
            paddingLeft: s(12),
            paddingRight: s(12),
            paddingBottom: s(12),
            maxHeight: s(380),
          }}
          data-task-list
          onPointerMove={handleTaskDragMove}
          onPointerUp={handleTaskDragEnd}
        >
          {loading && tasks.length === 0 && (
            <p
              style={{
                color: c.textMuted,
                textAlign: 'center',
                fontSize: s(13),
                paddingTop: s(16),
                paddingBottom: s(16),
              }}
            >
              読み込み中...
            </p>
          )}

          {!loading && tasks.length === 0 && !addingTask && (
            <p
              style={{
                color: c.textMuted,
                textAlign: 'center',
                fontSize: s(13),
                paddingTop: s(16),
                paddingBottom: s(16),
              }}
            >
              タスクはありません
            </p>
          )}

          {/* Add new task input */}
          {addingTask && (
            <div
              className="flex items-center"
              style={{
                gap: s(8),
                paddingLeft: s(4),
                paddingRight: s(4),
                paddingTop: s(8),
                paddingBottom: s(8),
                marginBottom: s(4),
                borderBottom: `1px solid ${c.divider}`,
              }}
            >
              {/* Spacer for drag handle alignment */}
              <div style={{ width: s(14), flexShrink: 0 }} />
              <div
                className="rounded-full"
                style={{
                  width: s(18),
                  height: s(18),
                  flexShrink: 0,
                  border: `2px solid ${c.textFaint}`,
                }}
              />
              <input
                ref={addInputRef}
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter') handleAddTask()
                  if (e.key === 'Escape') {
                    setAddingTask(false)
                    setNewTaskText('')
                  }
                }}
                onBlur={() => {
                  if (newTaskText.trim()) {
                    handleAddTask()
                  } else {
                    setAddingTask(false)
                  }
                }}
                placeholder="新しいタスク..."
                className="flex-1 bg-transparent outline-none"
                style={
                  {
                    cursor: 'text',
                    fontSize: s(14),
                    color: c.text,
                    '::placeholder': { color: c.textFaint },
                  } as React.CSSProperties
                }
              />
            </div>
          )}

          {/* Active tasks */}
          {tasks.map((task, index) => {
            const dueDateStatus = getDueDateStatus(task.dueDate)
            const isBeingDragged = dragItemId === task.taskId
            const showDropIndicator =
              dragOverIndex === index && dragItemId !== task.taskId

            return (
              <div key={task.taskId}>
                {showDropIndicator && (
                  <div
                    className="rounded-full mx-1"
                    style={{
                      height: 2,
                      marginTop: 2,
                      marginBottom: 2,
                      backgroundColor: c.textFaint,
                    }}
                  />
                )}
                <div
                  data-task-item
                  className={`flex items-start rounded-lg group transition-all ${isBeingDragged ? 'opacity-40' : ''}`}
                  style={{
                    gap: s(8),
                    paddingLeft: s(4),
                    paddingRight: s(4),
                    paddingTop: s(7),
                    paddingBottom: s(7),
                    backgroundColor:
                      dueDateStatus === 'urgent'
                        ? 'rgba(245, 158, 11, 0.05)'
                        : dueDateStatus === 'overdue'
                          ? 'rgba(239, 68, 68, 0.05)'
                          : 'transparent',
                  }}
                >
                  {/* Drag handle */}
                  <div
                    className="flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{
                      width: s(14),
                      height: s(18),
                      flexShrink: 0,
                    }}
                    onPointerDown={(e) => handleTaskDragStart(e, task.taskId)}
                  >
                    <svg
                      width={s(6)}
                      height={s(10)}
                      viewBox="0 0 6 10"
                      fill={c.accent}
                    >
                      <circle cx="1.5" cy="1.5" r="1" />
                      <circle cx="4.5" cy="1.5" r="1" />
                      <circle cx="1.5" cy="5" r="1" />
                      <circle cx="4.5" cy="5" r="1" />
                      <circle cx="1.5" cy="8.5" r="1" />
                      <circle cx="4.5" cy="8.5" r="1" />
                    </svg>
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={() => handleComplete(task.taskId)}
                    className="rounded-full transition-colors"
                    style={{
                      width: s(18),
                      height: s(18),
                      flexShrink: 0,
                      marginTop: s(1),
                      border: `2px solid ${c.checkboxBorder}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = c.checkboxHoverBorder
                      e.currentTarget.style.backgroundColor = c.checkboxHoverBg
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = c.checkboxBorder
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {editingId === task.taskId ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return
                          if (e.key === 'Enter') handleFinishEdit()
                          if (e.key === 'Escape') {
                            setEditingId(null)
                            setEditText('')
                          }
                        }}
                        onBlur={handleFinishEdit}
                        className="w-full bg-transparent outline-none"
                        style={{
                          cursor: 'text',
                          fontSize: s(14),
                          color: c.text,
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => handleStartEdit(task)}
                        className="cursor-text block break-words"
                        style={{
                          fontSize: s(14),
                          lineHeight: 1.4,
                          color: c.text,
                        }}
                      >
                        {task.title}
                      </span>
                    )}

                    {/* Due date */}
                    <div
                      className="flex items-center"
                      style={{ gap: s(4), marginTop: s(3) }}
                    >
                      {task.dueDate ? (
                        <button
                          onClick={(e) => openCalendar(e, task.taskId)}
                          style={{
                            fontSize: s(12),
                            color:
                              dueDateStatus === 'overdue'
                                ? '#ef4444'
                                : dueDateStatus === 'urgent'
                                  ? '#d97706'
                                  : c.textMuted,
                          }}
                        >
                          {formatDueDate(task.dueDate)}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => openCalendar(e, task.taskId)}
                          className="transition-colors"
                          style={{
                            fontSize: s(12),
                            color: 'transparent',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = c.textFaint)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = 'transparent')
                          }
                        >
                          期限を設定
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => taskStore.getState().deleteTask(task.taskId)}
                    className="flex items-center justify-center rounded opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                    style={{
                      width: s(18),
                      height: s(18),
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width={s(10)}
                      height={s(10)}
                      viewBox="0 0 8 8"
                      fill="none"
                      stroke={c.accent}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <line x1="1" y1="1" x2="7" y2="7" />
                      <line x1="7" y1="1" x2="1" y2="7" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}

          {/* Completed tasks section */}
          {showCompleted && completedTasks.length > 0 && (
            <div
              style={{
                marginTop: s(8),
                paddingTop: s(8),
                borderTop: `1px solid ${c.divider}`,
              }}
            >
              <p
                style={{
                  color: c.textMuted,
                  fontSize: s(11),
                  marginBottom: s(4),
                  paddingLeft: s(4),
                }}
              >
                完了済み
              </p>
              {completedTasks.map((task) => (
                <div
                  key={task.taskId}
                  className="flex items-center"
                  style={{
                    gap: s(8),
                    paddingLeft: s(4),
                    paddingRight: s(4),
                    paddingTop: s(5),
                    paddingBottom: s(5),
                  }}
                >
                  <div
                    className="rounded-full flex items-center justify-center"
                    style={{
                      width: s(18),
                      height: s(18),
                      flexShrink: 0,
                      backgroundColor: c.completedBg,
                    }}
                  >
                    <svg
                      width={s(10)}
                      height={s(10)}
                      viewBox="0 0 8 8"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1.5 4l2 2 3-3.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="line-through block break-words"
                      style={{
                        fontSize: s(14),
                        lineHeight: 1.4,
                        color: c.text,
                      }}
                    >
                      {task.title}
                    </span>
                    {(task.dueDate || task.completedAt) && (
                      <div
                        className="flex items-center flex-wrap"
                        style={{
                          gap: s(4),
                          marginTop: s(2),
                          fontSize: s(11),
                          color: c.textFaint,
                        }}
                      >
                        {task.dueDate && (
                          <span className="line-through">
                            {formatDueDate(task.dueDate)}
                          </span>
                        )}
                        {task.dueDate && task.completedAt && (
                          <span style={{ color: c.textMuted }}>→</span>
                        )}
                        {task.completedAt && (
                          <span style={{ color: c.textMuted }}>
                            {formatDueDate(task.completedAt.split('T')[0])}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resize handle (bottom-right, visible on hover) */}
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
              stroke={c.accentSub}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.4"
            />
          </svg>
        </div>
      </div>

      {/* Calendar portal (rendered outside panel to avoid backdrop-filter containment) */}
      {calendarAnchor &&
        calendarTask &&
        createPortal(
          <MiniCalendar
            selectedDate={calendarTask.dueDate}
            onSelect={(date) => handleDueDate(calendarAnchor.taskId, date)}
            onClose={() => setCalendarAnchor(null)}
            anchorRect={calendarAnchor.rect}
            isDark={isDark}
          />,
          document.body
        )}
    </>
  )
}
