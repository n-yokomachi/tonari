'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import homeStore from '@/features/stores/home'

const Live2DComponent = dynamic(() => import('./Live2DComponent'), {
  ssr: false,
})

export default function Live2DViewer() {
  const [isMounted, setIsMounted] = useState(false)
  const [scriptLoadRetries, setScriptLoadRetries] = useState({
    cubismcore: 0,
    live2d: 0,
  })
  const MAX_RETRIES = 3

  const isCubismCoreLoaded = homeStore((s) => s.isCubismCoreLoaded)
  const setIsCubismCoreLoaded = homeStore((s) => s.setIsCubismCoreLoaded)
  const isLive2dLoaded = homeStore((s) => s.isLive2dLoaded)
  const setIsLive2dLoaded = homeStore((s) => s.setIsLive2dLoaded)

  // スクリプトの再読み込み処理
  const retryLoadScript = (scriptName: 'cubismcore' | 'live2d') => {
    if (scriptLoadRetries[scriptName] < MAX_RETRIES) {
      setScriptLoadRetries((prev) => ({
        ...prev,
        [scriptName]: prev[scriptName] + 1,
      }))
      // 強制的に再読み込みするためにキーを変更
      return true
    }
    return false
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Script
        key={`cubismcore-${scriptLoadRetries.cubismcore}`}
        src="/scripts/live2dcubismcore.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          setIsCubismCoreLoaded(true)
        }}
        onError={() => {
          retryLoadScript('cubismcore')
        }}
      />
      {isCubismCoreLoaded && <Live2DComponent />}
    </div>
  )
}
