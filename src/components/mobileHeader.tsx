import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { IconButton } from './iconButton'
import Settings from './settings'
import settingsStore from '@/features/stores/settings'

export const MobileHeader = () => {
  const [showSettings, setShowSettings] = useState(false)
  const showControlPanel = settingsStore((s) => s.showControlPanel)
  const { t } = useTranslation()

  return (
    <>
      <header
        className="flex-shrink-0 bg-[#1a1a2e]/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between border-b border-[#D4AF37]/20"
        role="banner"
      >
        <Image src="/logo.png" alt="Scensei" width={120} height={40} priority />
        {showControlPanel && (
          <nav className="flex gap-2" aria-label="Main navigation">
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
