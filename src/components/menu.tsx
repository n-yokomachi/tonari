import React, { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/router'
import Image from 'next/image'
import Link from 'next/link'

import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore from '@/features/stores/settings'
import { resetSessionId } from '@/features/chat/agentCoreChat'
import { ChatLog } from './chatLog'
import { IconButton } from './iconButton'
import Settings from './settings'
import { VRM_MODELS } from '@/features/constants/settings'

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

export const Menu = ({ isPortrait }: { isPortrait?: boolean }) => {
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
        {/* ヘッダー部分（デスクトップ横画面のみ表示、モバイル/縦画面は別コンポーネント） */}
        {!isMobile && !isPortrait && (
          <div className="flex-shrink-0 z-15 px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-light tracking-[0.2em] text-secondary font-Montserrat leading-tight">
                  TONaRi
                </span>
                <span className="text-[7px] text-gray-400 tracking-[0.08em] font-light font-Montserrat">
                  An AI Agent Standing With You
                </span>
              </div>
              <div className="flex gap-[8px]">
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
                    <IconButton
                      iconName="24/Settings"
                      isProcessing={false}
                      onClick={() => setShowSettings(true)}
                      aria-label={t('BasedSettings')}
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
              </div>
            </div>
          </div>
        )}
        {/* チャットログ */}
        <div className="flex-1 overflow-hidden">
          <ChatLog isPortrait={isPortrait} />
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
