import React, { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/router'
import Image from 'next/image'
import Link from 'next/link'

import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore from '@/features/stores/settings'
import { ChatLog } from './chatLog'
import { IconButton } from './iconButton'
import Settings from './settings'

// モバイルデバイス検出用のカスタムフック
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    // モバイルデバイス検出用の関数
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth <= 768 ||
          /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      )
    }

    // 初回レンダリング時とウィンドウサイズ変更時に検出
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export const Menu = () => {
  const showControlPanel = settingsStore((s) => s.showControlPanel)

  const [showSettings, setShowSettings] = useState(false)

  // ロングタップ用のステート
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null)

  // モバイルデバイス検出
  const isMobile = useIsMobile()

  const { t } = useTranslation()
  const router = useRouter()

  // ロングタップ処理用の関数
  const handleTouchStart = () => {
    setTouchStartTime(Date.now())
  }

  const handleTouchEnd = () => {
    if (touchStartTime && Date.now() - touchStartTime >= 800) {
      // 800ms以上押し続けるとロングタップと判定
      setShowSettings(true)
    }
    setTouchStartTime(null)
  }

  const handleTouchCancel = () => {
    setTouchStartTime(null)
  }

  const handleChangeVrmFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files) return

      const file = files[0]
      if (!file) return

      const file_type = file.name.split('.').pop()

      if (file_type === 'vrm') {
        const blob = new Blob([file], { type: 'application/octet-stream' })
        const url = window.URL.createObjectURL(blob)

        const hs = homeStore.getState()
        hs.viewer.loadVrm(url)
      }

      event.target.value = ''
    },
    []
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        setShowSettings((prevState) => !prevState)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <>
      {/* ロングタップ用の透明な領域（モバイルでコントロールパネルが非表示の場合） */}
      {isMobile === true && !showControlPanel && (
        <div
          className="absolute top-0 left-0 z-30 w-20 h-20"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div className="w-full h-full opacity-0"></div>
        </div>
      )}

      <div className="flex flex-col h-full">
        {/* ヘッダー部分（デスクトップのみ表示、モバイルはMobileHeaderを使用） */}
        {!isMobile && (
          <div className="flex-shrink-0 z-15 px-4 py-2">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Scensei"
                width={120}
                height={40}
                priority
              />
              <div className="flex gap-[8px]">
                {showControlPanel && (
                  <>
                    <IconButton
                      iconName="24/Settings"
                      isProcessing={false}
                      onClick={() => setShowSettings(true)}
                      aria-label={t('BasedSettings')}
                    />
                    <Link
                      href="/admin/perfumes"
                      className="bg-primary hover:bg-primary-hover active:bg-primary-press rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme"
                      aria-label={t('PerfumeDataManagement')}
                    >
                      <Image
                        src="/images/icons/database.svg"
                        alt={t('PerfumeDataManagement')}
                        width={24}
                        height={24}
                      />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {/* チャットログ */}
        <div className="flex-1 overflow-hidden">
          <ChatLog />
        </div>
      </div>
      {showSettings && <Settings onClickClose={() => setShowSettings(false)} />}
      <input
        type="file"
        className="hidden"
        accept=".vrm"
        ref={(fileInput) => {
          if (!fileInput) {
            menuStore.setState({ fileInput: null })
            return
          }

          menuStore.setState({ fileInput })
        }}
        onChange={handleChangeVrmFile}
      />
      <input
        type="file"
        className="hidden"
        accept="image/*"
        ref={(bgFileInput) => {
          if (!bgFileInput) {
            menuStore.setState({ bgFileInput: null })
            return
          }

          menuStore.setState({ bgFileInput })
        }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const imageUrl = URL.createObjectURL(file)
            homeStore.setState({ backgroundImageUrl: imageUrl })
          }
        }}
      />
    </>
  )
}
