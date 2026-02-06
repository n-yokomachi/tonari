import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { IconButton } from './iconButton'
import Settings from './settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { VRM_MODELS } from '@/features/constants/settings'

export const MobileHeader = () => {
  const [showSettings, setShowSettings] = useState(false)
  const showControlPanel = settingsStore((s) => s.showControlPanel)
  const { t } = useTranslation()

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
        className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        role="banner"
      >
        <Image src="/logo.png" alt="Scensei" width={120} height={40} priority />
        {showControlPanel && (
          <nav className="flex gap-2" aria-label="Main navigation">
            <IconButton
              iconName="24/Swap"
              isProcessing={false}
              onClick={handleSwitchVrmModel}
              aria-label="モデル切り替え"
            />
            <IconButton
              iconName="24/Settings"
              isProcessing={false}
              onClick={() => setShowSettings(true)}
              aria-label={t('BasedSettings')}
            />
          </nav>
        )}
      </header>
      {showSettings && <Settings onClickClose={() => setShowSettings(false)} />}
    </>
  )
}
