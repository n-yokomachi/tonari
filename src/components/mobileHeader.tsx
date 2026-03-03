import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import Image from 'next/image'
import { IconButton } from './iconButton'
import { NewsNotification } from './newsNotification'
import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore from '@/features/stores/settings'
import pomodoroStore from '@/features/stores/pomodoro'
import taskStore from '@/features/stores/tasks'
import { resetSessionId } from '@/features/chat/agentCoreChat'
import { VRM_MODELS } from '@/features/constants/settings'

const TaskIconButton = () => {
  const urgentTaskCount = taskStore((s) => s.urgentTaskCount)
  return (
    <button
      onClick={() => taskStore.getState().toggle()}
      className="bg-transparent hover:bg-white/10 active:bg-white/20 rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme relative"
      aria-label="タスク一覧"
    >
      <Image
        src="/images/icons/tasks.svg"
        alt="タスク"
        width={24}
        height={24}
      />
      {urgentTaskCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {urgentTaskCount > 9 ? '9+' : urgentTaskCount}
        </span>
      )}
    </button>
  )
}

export const MobileHeader = ({ showLogo }: { showLogo?: boolean }) => {
  const showControlPanel = settingsStore((s) => s.showControlPanel)
  const isDark = settingsStore((s) => s.colorTheme === 'tonari-dark')
  const { t } = useTranslation()

  const handleNewSession = useCallback(() => {
    resetSessionId()
    homeStore.setState({ chatLog: [] })
  }, [])

  const handleSwitchVrmModel = useCallback(() => {
    const currentPath = settingsStore.getState().selectedVrmPath
    const nextPath =
      currentPath === VRM_MODELS[0] ? VRM_MODELS[1] : VRM_MODELS[0]
    settingsStore.setState({ selectedVrmPath: nextPath })
    const { viewer } = homeStore.getState()
    viewer.loadVrm(nextPath)
  }, [])

  return (
    <>
      <header
        className="absolute top-0 left-0 right-0 z-20 px-4 py-2 flex items-center justify-start"
        role="banner"
      >
        {showLogo && (
          <div className="flex flex-col items-center mr-3">
            <span className="text-2xl font-light tracking-[0.2em] text-secondary font-Montserrat leading-tight">
              TONaRi
            </span>
            <span className="text-[7px] text-gray-400 dark:text-gray-500 tracking-[0.08em] font-light font-Montserrat">
              An AI Agent Standing With You
            </span>
          </div>
        )}
        <nav
          className="flex gap-2 rounded-3xl px-2 py-1 bg-white/25 dark:bg-[rgba(20,20,35,0.45)] border border-white/40 dark:border-white/10"
          style={{
            backdropFilter: 'blur(16px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
          aria-label="Main navigation"
        >
          {showControlPanel ? (
            <>
              <IconButton
                iconName="24/Refresh"
                isProcessing={false}
                backgroundColor="bg-transparent hover:bg-white/10 active:bg-white/20"
                onClick={handleNewSession}
                aria-label="新しいセッション"
              />
              <IconButton
                iconName="24/Swap"
                isProcessing={false}
                backgroundColor="bg-transparent hover:bg-white/10 active:bg-white/20"
                onClick={handleSwitchVrmModel}
                aria-label="モデル切り替え"
              />
              <IconButton
                iconName="24/Settings"
                isProcessing={false}
                backgroundColor="bg-transparent hover:bg-white/10 active:bg-white/20"
                onClick={() => menuStore.setState({ showSettings: true })}
                aria-label={t('BasedSettings')}
              />
              <Link
                href="/admin"
                className="bg-transparent hover:bg-white/10 active:bg-white/20 rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme"
                aria-label="管理画面"
              >
                <Image
                  src="/images/icons/admin.svg"
                  alt="管理画面"
                  width={24}
                  height={24}
                />
              </Link>
              <IconButton
                iconName="24/Timer"
                isProcessing={false}
                backgroundColor="bg-transparent hover:bg-white/10 active:bg-white/20"
                onClick={() => pomodoroStore.getState().toggle()}
                aria-label="ポモドーロタイマー"
              />
              <TaskIconButton />
              <button
                onClick={async () => {
                  await fetch('/api/admin/auth', { method: 'DELETE' })
                  window.location.href = '/login'
                }}
                className="bg-transparent hover:bg-white/10 active:bg-white/20 rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme"
                aria-label="ログアウト"
              >
                <Image
                  src="/images/icons/logout.svg"
                  alt="ログアウト"
                  width={24}
                  height={24}
                />
              </button>
              <NewsNotification />
            </>
          ) : (
            <>
              <IconButton
                iconName="24/Timer"
                isProcessing={false}
                backgroundColor="bg-transparent hover:bg-white/10 active:bg-white/20"
                onClick={() => pomodoroStore.getState().toggle()}
                aria-label="ポモドーロタイマー"
              />
              <TaskIconButton />
              <NewsNotification />
            </>
          )}
        </nav>
      </header>
    </>
  )
}
