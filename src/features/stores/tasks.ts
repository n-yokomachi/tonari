import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Task {
  taskId: string
  title: string
  dueDate: string | null
  sortOrder: number
  completed: boolean
  createdAt: string
  completedAt: string | null
}

interface TaskState {
  // Data
  tasks: Task[]
  completedTasks: Task[]
  loading: boolean

  // UI State (persisted)
  isVisible: boolean
  showCompleted: boolean

  // Actions
  toggle: () => void
  setVisible: (visible: boolean) => void
  toggleShowCompleted: () => void
  fetchTasks: () => Promise<void>
  addTask: (title: string, dueDate?: string) => Promise<void>
  updateTask: (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'dueDate'>>
  ) => Promise<void>
  completeTask: (taskId: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  reorderTasks: (taskIds: string[]) => Promise<void>
}

function getUrgentTaskCount(tasks: Task[]): number {
  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  return tasks.filter((task) => {
    if (task.completed || !task.dueDate) return false
    const due = new Date(task.dueDate + 'T23:59:59')
    return due <= threeDaysLater
  }).length
}

const taskStore = create<TaskState & { urgentTaskCount: number }>()(
  persist(
    (set, get) => ({
      // Data
      tasks: [],
      completedTasks: [],
      loading: false,

      // UI State
      isVisible: false,
      showCompleted: false,

      // Computed
      urgentTaskCount: 0,

      // Actions
      toggle: () => set((s) => ({ isVisible: !s.isVisible })),
      setVisible: (visible: boolean) => set({ isVisible: visible }),
      toggleShowCompleted: () =>
        set((s) => ({ showCompleted: !s.showCompleted })),

      fetchTasks: async () => {
        set({ loading: true })
        try {
          const [activeRes, completedRes] = await Promise.all([
            fetch('/api/admin/tasks'),
            fetch('/api/admin/tasks?includeCompleted=true'),
          ])

          if (activeRes.ok) {
            const activeData = await activeRes.json()
            const activeTasks = (activeData.tasks || []).filter(
              (t: Task) => !t.completed
            )
            set({
              tasks: activeTasks,
              urgentTaskCount: getUrgentTaskCount(activeTasks),
            })
          }

          if (completedRes.ok) {
            const completedData = await completedRes.json()
            const completed = (completedData.tasks || []).filter(
              (t: Task) => t.completed
            )
            set({ completedTasks: completed })
          }
        } catch (err) {
          console.error('Failed to fetch tasks:', err)
        } finally {
          set({ loading: false })
        }
      },

      addTask: async (title: string, dueDate?: string) => {
        const tempId = `temp-${Date.now()}`
        const tempTask: Task = {
          taskId: tempId,
          title,
          dueDate: dueDate || null,
          sortOrder: get().tasks.length,
          completed: false,
          createdAt: new Date().toISOString(),
          completedAt: null,
        }

        // Optimistic update
        set((s) => ({
          tasks: [...s.tasks, tempTask],
        }))

        try {
          const res = await fetch('/api/admin/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, dueDate }),
          })

          if (res.ok) {
            const data = await res.json()
            set((s) => ({
              tasks: s.tasks.map((t) => (t.taskId === tempId ? data.task : t)),
              urgentTaskCount: getUrgentTaskCount(
                s.tasks.map((t) => (t.taskId === tempId ? data.task : t))
              ),
            }))
          } else {
            // Rollback
            set((s) => ({
              tasks: s.tasks.filter((t) => t.taskId !== tempId),
            }))
          }
        } catch {
          set((s) => ({
            tasks: s.tasks.filter((t) => t.taskId !== tempId),
          }))
        }
      },

      updateTask: async (
        taskId: string,
        updates: Partial<Pick<Task, 'title' | 'dueDate'>>
      ) => {
        const prev = get().tasks.find((t) => t.taskId === taskId)
        if (!prev) return

        // Optimistic update
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.taskId === taskId ? { ...t, ...updates } : t
          ),
        }))

        try {
          const res = await fetch(`/api/admin/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })

          if (res.ok) {
            const data = await res.json()
            set((s) => {
              const newTasks = s.tasks.map((t) =>
                t.taskId === taskId ? data.task : t
              )
              return {
                tasks: newTasks,
                urgentTaskCount: getUrgentTaskCount(newTasks),
              }
            })
          } else {
            // Rollback
            set((s) => ({
              tasks: s.tasks.map((t) => (t.taskId === taskId ? prev : t)),
            }))
          }
        } catch {
          set((s) => ({
            tasks: s.tasks.map((t) => (t.taskId === taskId ? prev : t)),
          }))
        }
      },

      completeTask: async (taskId: string) => {
        const task = get().tasks.find((t) => t.taskId === taskId)
        if (!task) return

        // Optimistic update
        set((s) => ({
          tasks: s.tasks.filter((t) => t.taskId !== taskId),
          urgentTaskCount: getUrgentTaskCount(
            s.tasks.filter((t) => t.taskId !== taskId)
          ),
        }))

        try {
          const res = await fetch(`/api/admin/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
          })

          if (res.ok) {
            // Refresh completed tasks
            get().fetchTasks()
          } else {
            // Rollback
            set((s) => ({
              tasks: [...s.tasks, task].sort(
                (a, b) => a.sortOrder - b.sortOrder
              ),
              urgentTaskCount: getUrgentTaskCount([...s.tasks, task]),
            }))
          }
        } catch {
          set((s) => ({
            tasks: [...s.tasks, task].sort((a, b) => a.sortOrder - b.sortOrder),
            urgentTaskCount: getUrgentTaskCount([...s.tasks, task]),
          }))
        }
      },

      deleteTask: async (taskId: string) => {
        const task = get().tasks.find((t) => t.taskId === taskId)
        if (!task) return

        set((s) => ({
          tasks: s.tasks.filter((t) => t.taskId !== taskId),
          urgentTaskCount: getUrgentTaskCount(
            s.tasks.filter((t) => t.taskId !== taskId)
          ),
        }))

        try {
          const res = await fetch(`/api/admin/tasks/${taskId}`, {
            method: 'DELETE',
          })

          if (!res.ok) {
            set((s) => ({
              tasks: [...s.tasks, task].sort(
                (a, b) => a.sortOrder - b.sortOrder
              ),
              urgentTaskCount: getUrgentTaskCount([...s.tasks, task]),
            }))
          }
        } catch {
          set((s) => ({
            tasks: [...s.tasks, task].sort((a, b) => a.sortOrder - b.sortOrder),
            urgentTaskCount: getUrgentTaskCount([...s.tasks, task]),
          }))
        }
      },

      reorderTasks: async (taskIds: string[]) => {
        const prevTasks = [...get().tasks]

        // Optimistic update
        set((s) => ({
          tasks: taskIds
            .map((id, index) => {
              const task = s.tasks.find((t) => t.taskId === id)
              return task ? { ...task, sortOrder: index } : null
            })
            .filter((t): t is Task => t !== null),
        }))

        try {
          const res = await fetch('/api/admin/tasks/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskIds }),
          })

          if (!res.ok) {
            set({ tasks: prevTasks })
          }
        } catch {
          set({ tasks: prevTasks })
        }
      },
    }),
    {
      name: 'tonari-tasks',
      partialize: (state) => ({
        isVisible: state.isVisible,
        showCompleted: state.showCompleted,
      }),
    }
  )
)

export default taskStore
