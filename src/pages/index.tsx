import { useState, useCallback, useEffect, useRef } from 'react'
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
import { useIsMobile, useIsPortrait } from '@/hooks/useMediaQuery'
import { useIdleMotion } from '@/hooks/useIdleMotion'
import { useSleepMode } from '@/hooks/useSleepMode'
import { usePomodoroTimer } from '@/hooks/usePomodoroTimer'
import { usePomodoroMotion } from '@/hooks/usePomodoroMotion'
import { MobileHeader } from '@/components/mobileHeader'
import { GestureTestPanel } from '@/components/gestureTestPanel'
import { PomodoroTimer } from '@/components/pomodoroTimer'
import { TaskListPanel } from '@/components/taskListPanel'

const CHAT_WIDTH_KEY = 'tonari-chat-width'
const DEFAULT_CHAT_WIDTH = 500
const MIN_CHAT_WIDTH = 300
const MAX_CHAT_WIDTH = 900

const Home = () => {
  const isMobile = useIsMobile()
  const isPortrait = useIsPortrait()
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)
  const [pageReady, setPageReady] = useState(false)
  const [animationDone, setAnimationDone] = useState(false)

  // 縦モニター: チャットログの自動非表示
  const [chatVisible, setChatVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatLog = homeStore((s) => s.chatLog)

  const showChatTemporarily = useCallback(() => {
    setChatVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setChatVisible(false), 10000)
  }, [])

  // 新しいメッセージが来たら表示してタイマーリセット（モバイル・縦モニター共通）
  useEffect(() => {
    if ((isPortrait || isMobile) && chatLog.length > 0) {
      showChatTemporarily()
    }
  }, [chatLog.length, isPortrait, isMobile, showChatTemporarily])

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

  useIdleMotion()
  useSleepMode()
  usePomodoroTimer()
  usePomodoroMotion()

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

  const colorTheme = settingsStore((s) => s.colorTheme)
  const isDark = colorTheme === 'tonari-dark'

  const backgroundStyle =
    webcamStatus && useVideoAsBackground
      ? {}
      : backgroundImageUrl === 'green'
        ? { backgroundColor: '#00FF00' }
        : backgroundImageUrl === 'gradient'
          ? {
              background: isDark
                ? 'linear-gradient(135deg, #1a1a2e 0%, #1e1e35 40%, #1a2530 70%, #1a2a28 100%)'
                : 'linear-gradient(135deg, #f5f0e8 0%, #f0ece4 40%, #e8efe6 70%, #e0ebe0 100%)',
            }
          : backgroundImageUrl
            ? { backgroundImage: bgUrl }
            : { backgroundColor: isDark ? '#1a1a2e' : '#E8E8E8' }

  const layoutReady = isMobile !== null && isPortrait !== null

  useEffect(() => {
    if (layoutReady && !pageReady) {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPageReady(true))
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [layoutReady, pageReady])

  // Remove transform after animation completes so position:fixed works correctly
  useEffect(() => {
    if (pageReady) {
      const timer = setTimeout(() => setAnimationDone(true), 900)
      return () => clearTimeout(timer)
    }
  }, [pageReady])

  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col"
      style={{
        ...backgroundStyle,
        opacity: pageReady ? 1 : 0,
        transform: animationDone
          ? undefined
          : pageReady
            ? 'translateY(0)'
            : 'translateY(-12px)',
        transition: pageReady
          ? 'opacity 0.8s ease-out, transform 0.8s ease-out'
          : 'none',
      }}
    >
      <Meta />
      {!layoutReady ? null : isMobile || isPortrait ? (
        <>
          {/* モバイル/縦モニター: VRM全画面背景 */}
          <div className="absolute inset-0 z-0">
            <VrmViewer />
          </div>
          {/* モバイル/縦モニター: ヘッダー（上部固定） */}
          <MobileHeader showLogo={!isMobile} />
          {/* スペーサー（ポインターイベントはキャンバスに透過） */}
          <div className="flex-1" />
          {/* モバイル/縦モニター: チャットログ（下部） */}
          <div
            className={`relative z-10 max-h-[35vh] overflow-hidden transition-opacity duration-500 ${
              chatVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={showChatTemporarily}
          >
            <Menu isPortrait />
          </div>
          {/* モバイル/縦モニター: 入力欄（最下部） */}
          <div
            className={`flex-shrink-0 relative z-10 transition-opacity duration-500 ${
              chatVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onFocus={showChatTemporarily}
          >
            <Form />
          </div>
        </>
      ) : (
        <>
          {/* デスクトップ: VRM全画面背景 */}
          <div className="absolute inset-0 z-0">
            <VrmViewer />
          </div>
          {/* デスクトップ: メインエリア（チャット + リサイザー） */}
          <div className="flex-1 flex overflow-hidden relative z-10 pointer-events-none">
            {/* 左: チャットUI（透過） */}
            <div
              className="overflow-hidden flex-shrink-0 pointer-events-auto"
              style={{ width: chatWidth }}
            >
              <Menu />
            </div>
            {/* リサイザー */}
            <div className="pointer-events-auto">
              <ResizableDivider
                onResize={handleResize}
                minWidth={MIN_CHAT_WIDTH}
                maxWidth={MAX_CHAT_WIDTH}
                initialWidth={chatWidth}
              />
            </div>
            {/* 右: VRMへのポインタ透過用スペース */}
            <div className="flex-1" />
          </div>
          {/* デスクトップ: 下部 - 入力欄（全幅） */}
          <div className="flex-shrink-0 relative z-10 pointer-events-auto">
            <Form />
          </div>
        </>
      )}
      {/* <GestureTestPanel /> */}
      <PomodoroTimer />
      <TaskListPanel />
      {messageReceiverEnabled && <MessageReceiver />}
      <Toasts />
      <WebSocketManager />
      <ImageOverlay />
    </div>
  )
}

export default Home
