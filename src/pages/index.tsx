import { useState, useCallback, useEffect } from 'react'
import { Form } from '@/components/form'
import MessageReceiver from '@/components/messageReceiver'
import { Menu } from '@/components/menu'
import { Meta } from '@/components/meta'

import VrmViewer from '@/components/vrmViewer'
import { Toasts } from '@/components/toasts'
import { WebSocketManager } from '@/components/websocketManager'
import ImageOverlay from '@/components/ImageOverlay'
import { ResizableDivider } from '@/components/resizableDivider'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/lib/i18n'
import { buildUrl } from '@/utils/buildUrl'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { MobileHeader } from '@/components/mobileHeader'

const CHAT_WIDTH_KEY = 'tonari-chat-width'
const DEFAULT_CHAT_WIDTH = 500
const MIN_CHAT_WIDTH = 300
const MAX_CHAT_WIDTH = 900

const Home = () => {
  const isMobile = useIsMobile()
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)

  // ローカルストレージから幅を復元
  useEffect(() => {
    const saved = localStorage.getItem(CHAT_WIDTH_KEY)
    if (saved) {
      const width = parseInt(saved, 10)
      if (!isNaN(width) && width >= MIN_CHAT_WIDTH && width <= MAX_CHAT_WIDTH) {
        setChatWidth(width)
      }
    }
  }, [])

  const handleResize = useCallback((width: number) => {
    setChatWidth(width)
    localStorage.setItem(CHAT_WIDTH_KEY, String(width))
  }, [])

  const webcamStatus = homeStore((s) => s.webcamStatus)
  const backgroundImageUrl = homeStore((s) => s.backgroundImageUrl)
  const useVideoAsBackground = settingsStore((s) => s.useVideoAsBackground)
  const bgUrl =
    webcamStatus && useVideoAsBackground
      ? ''
      : backgroundImageUrl === 'green'
        ? ''
        : `url(${buildUrl(backgroundImageUrl)})`
  const messageReceiverEnabled = settingsStore((s) => s.messageReceiverEnabled)

  const backgroundStyle =
    webcamStatus && useVideoAsBackground
      ? {}
      : backgroundImageUrl === 'green'
        ? { backgroundColor: '#00FF00' }
        : backgroundImageUrl === 'gradient'
          ? {
              background:
                'linear-gradient(135deg, #f5f0e8 0%, #f0ece4 40%, #e8efe6 70%, #e0ebe0 100%)',
            }
          : backgroundImageUrl
            ? { backgroundImage: bgUrl }
            : { backgroundColor: '#E8E8E8' }

  // SSR時はローディング表示
  if (isMobile === null) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#E8E8E8]">
        <Meta />
      </div>
    )
  }

  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col"
      style={backgroundStyle}
    >
      <Meta />
      {isMobile ? (
        <>
          {/* モバイル: ヘッダー（最上部） */}
          <MobileHeader />
          {/* モバイル: VRMビューワー */}
          <div className="h-[35vh] min-h-[180px]">
            <VrmViewer />
          </div>
          {/* モバイル: チャットUI（中央） */}
          <div className="flex-1 overflow-hidden">
            <Menu />
          </div>
          {/* モバイル: 入力欄（下部） */}
          <div className="flex-shrink-0">
            <Form />
          </div>
        </>
      ) : (
        <>
          {/* デスクトップ: メインエリア（チャット + リサイザー + VRM） */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左: チャットUI */}
            <div
              className="overflow-hidden flex-shrink-0"
              style={{ width: chatWidth }}
            >
              <Menu />
            </div>
            {/* リサイザー */}
            <ResizableDivider
              onResize={handleResize}
              minWidth={MIN_CHAT_WIDTH}
              maxWidth={MAX_CHAT_WIDTH}
              initialWidth={chatWidth}
            />
            {/* 右: VRMビューワー */}
            <div className="flex-1 overflow-hidden">
              <VrmViewer />
            </div>
          </div>
          {/* デスクトップ: 下部 - 入力欄（全幅） */}
          <div className="flex-shrink-0">
            <Form />
          </div>
        </>
      )}
      {messageReceiverEnabled && <MessageReceiver />}
      <Toasts />
      <WebSocketManager />
      <ImageOverlay />
    </div>
  )
}

export default Home
