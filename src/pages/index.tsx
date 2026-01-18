import { Form } from '@/components/form'
import MessageReceiver from '@/components/messageReceiver'
import { Menu } from '@/components/menu'
import { Meta } from '@/components/meta'
import ModalImage from '@/components/modalImage'
import VrmViewer from '@/components/vrmViewer'
import { Toasts } from '@/components/toasts'
import { WebSocketManager } from '@/components/websocketManager'
import ImageOverlay from '@/components/ImageOverlay'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/lib/i18n'
import { buildUrl } from '@/utils/buildUrl'
import { YoutubeManager } from '@/components/youtubeManager'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { MobileHeader } from '@/components/mobileHeader'

const Home = () => {
  const isMobile = useIsMobile()
  const webcamStatus = homeStore((s) => s.webcamStatus)
  const captureStatus = homeStore((s) => s.captureStatus)
  const backgroundImageUrl = homeStore((s) => s.backgroundImageUrl)
  const useVideoAsBackground = settingsStore((s) => s.useVideoAsBackground)
  const bgUrl =
    (webcamStatus || captureStatus) && useVideoAsBackground
      ? ''
      : backgroundImageUrl === 'green'
        ? ''
        : `url(${buildUrl(backgroundImageUrl)})`
  const messageReceiverEnabled = settingsStore((s) => s.messageReceiverEnabled)

  const backgroundStyle =
    (webcamStatus || captureStatus) && useVideoAsBackground
      ? {}
      : backgroundImageUrl === 'green'
        ? { backgroundColor: '#00FF00' }
        : backgroundImageUrl
          ? { backgroundImage: bgUrl }
          : { backgroundColor: '#E8E8E8' }

  // モバイル用レイアウト: 縦並び（VRM上、チャット中、入力下）
  // デスクトップ用レイアウト: 横並び（チャット左、VRM右、入力下）
  const gridStyle = isMobile
    ? {
        display: 'flex',
        flexDirection: 'column' as const,
      }
    : {
        display: 'grid',
        gridTemplateColumns: 'minmax(400px, 800px) 1fr',
        gridTemplateRows: '1fr auto',
      }

  return (
    <div
      className="w-screen h-screen overflow-hidden"
      style={{
        ...backgroundStyle,
        ...gridStyle,
      }}
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
          {/* デスクトップ: 左上 - チャットUI */}
          <div
            className="overflow-hidden"
            style={{ gridColumn: '1', gridRow: '1' }}
          >
            <Menu />
          </div>
          {/* デスクトップ: 右上 - VRMビューワー */}
          <div
            className="overflow-hidden"
            style={{
              gridColumn: '2',
              gridRow: '1',
            }}
          >
            <VrmViewer />
          </div>
          {/* デスクトップ: 下部 - 入力欄（全幅） */}
          <div style={{ gridColumn: '1 / -1', gridRow: '2' }}>
            <Form />
          </div>
        </>
      )}
      <ModalImage />
      {messageReceiverEnabled && <MessageReceiver />}
      <Toasts />
      <WebSocketManager />
      <YoutubeManager />
      <ImageOverlay />
    </div>
  )
}

export default Home
