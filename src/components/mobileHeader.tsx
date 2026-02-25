import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import Image from 'next/image'
import { IconButton } from './iconButton'
import Settings from './settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { resetSessionId } from '@/features/chat/agentCoreChat'
import { VRM_MODELS } from '@/features/constants/settings'

export const MobileHeader = () => {
  const [showSettings, setShowSettings] = useState(false)
  const showControlPanel = settingsStore((s) => s.showControlPanel)
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
        className="absolute top-0 left-0 right-0 z-20 px-4 py-2 flex items-center justify-end"
        role="banner"
      >
        <nav className="flex gap-2" aria-label="Main navigation">
          {showControlPanel && (
            <>
              <IconButton
                iconName="24/Refresh"
                isProcessing={false}
                onClick={handleNewSession}
                aria-label="新しいセッション"
              />
              <IconButton
                iconName="24/Swap"
                isProcessing={false}
                onClick={handleSwitchVrmModel}
                aria-label="モデル切り替え"
              />
              <Link
                href="/admin"
                className="bg-primary hover:bg-primary-hover active:bg-primary-press rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme"
                aria-label="管理画面"
              >
                <Image
                  src="/images/icons/admin.svg"
                  alt="管理画面"
                  width={24}
                  height={24}
                />
              </Link>
              <button
                onClick={async () => {
                  await fetch('/api/admin/auth', { method: 'DELETE' })
                  window.location.href = '/login'
                }}
                className="bg-primary hover:bg-primary-hover active:bg-primary-press rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme"
                aria-label="ログアウト"
              >
                <Image
                  src="/images/icons/logout.svg"
                  alt="ログアウト"
                  width={24}
                  height={24}
                />
              </button>
            </>
          )}
          <IconButton
            iconName="24/Settings"
            isProcessing={false}
            onClick={() => setShowSettings(true)}
            aria-label={t('BasedSettings')}
          />
        </nav>
      </header>
      {showSettings && <Settings onClickClose={() => setShowSettings(false)} />}
    </>
  )
}
