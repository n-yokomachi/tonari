import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { LiquidMetal } from './liquidMetal'
import { CreepyLogo } from './menu'

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

  const [showVrmMenu, setShowVrmMenu] = useState(false)
  const vrmBtnRef = useRef<HTMLDivElement>(null)
  const vrmDropdownRef = useRef<HTMLDivElement>(null)
  const [vrmMenuPos, setVrmMenuPos] = useState({ top: 0, left: 0 })

  const handleSelectVrmModel = useCallback((path: string) => {
    settingsStore.setState({ selectedVrmPath: path })
    const { viewer } = homeStore.getState()
    viewer.loadVrm(path)
    setShowVrmMenu(false)
  }, [])

  const handleToggleVrmMenu = useCallback(() => {
    setShowVrmMenu((prev) => {
      if (!prev && vrmBtnRef.current) {
        const rect = vrmBtnRef.current.getBoundingClientRect()
        setVrmMenuPos({ top: rect.bottom + 4, left: rect.left })
      }
      return !prev
    })
  }, [])

  useEffect(() => {
    if (!showVrmMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        vrmBtnRef.current &&
        !vrmBtnRef.current.contains(e.target as Node) &&
        vrmDropdownRef.current &&
        !vrmDropdownRef.current.contains(e.target as Node)
      ) {
        setShowVrmMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showVrmMenu])

  return (
    <>
      <header
        className="absolute top-0 left-0 right-0 z-20 px-4 py-2 flex items-center justify-start"
        role="banner"
      >
        {showLogo && (
          <div className="mr-3">
            <CreepyLogo isDark={isDark} />
          </div>
        )}
        <div
          className="relative rounded-3xl"
          style={{
            boxShadow: isDark
              ? '0 4px 24px rgba(0,0,0,0.3)'
              : '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Liquid Metal border frame (light mode only) */}
          {!isDark && (
            <div
              className="absolute inset-0 z-20 pointer-events-none rounded-3xl"
              style={{
                padding: 2,
                WebkitMask:
                  'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
              }}
            >
              <LiquidMetal
                colorBack="#c8c8cc"
                colorTint="#ffffff"
                speed={0.3}
                repetition={6}
                distortion={0.08}
                scale={1.2}
                shiftRed={0.15}
                shiftBlue={0.15}
              />
            </div>
          )}
          <nav
            className="relative z-10 flex gap-2 rounded-3xl px-2 py-1 bg-white/25 dark:bg-[rgba(20,20,35,0.45)] dark:border dark:border-white/10 overflow-hidden"
            style={{
              backdropFilter: 'blur(16px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
              boxShadow: isDark
                ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                : 'inset 0 1px 0 rgba(255,255,255,0.5)',
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
                <div ref={vrmBtnRef}>
                  <IconButton
                    iconName="24/Swap"
                    isProcessing={false}
                    backgroundColor="bg-transparent hover:bg-white/10 active:bg-white/20"
                    onClick={handleToggleVrmMenu}
                    aria-label="モデル切り替え"
                  />
                </div>
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
        </div>
      </header>
      {showVrmMenu && (
        <div
          ref={vrmDropdownRef}
          className="fixed bg-white/90 dark:bg-[rgba(20,20,35,0.9)] backdrop-blur-md rounded-xl shadow-lg border border-white/20 dark:border-white/10 py-1 z-[100] min-w-[160px]"
          style={{ top: vrmMenuPos.top, left: vrmMenuPos.left }}
        >
          {VRM_MODELS.map((model) => (
            <button
              key={model.label}
              onClick={() => handleSelectVrmModel(model.path)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                settingsStore.getState().selectedVrmPath === model.path
                  ? 'bg-secondary/20 text-secondary font-bold'
                  : 'hover:bg-white/20 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200'
              }`}
            >
              {model.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
