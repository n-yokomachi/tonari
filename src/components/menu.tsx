import React, { useCallback, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/router'
import Image from 'next/image'
import Link from 'next/link'
import { animate, motion } from 'framer-motion'

import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore from '@/features/stores/settings'
import pomodoroStore from '@/features/stores/pomodoro'
import taskStore from '@/features/stores/tasks'
import { resetSessionId } from '@/features/chat/agentCoreChat'
import { ChatLog } from './chatLog'
import { IconButton } from './iconButton'
import { NewsNotification } from './newsNotification'
import { VRM_MODELS } from '@/features/constants/settings'
import { LiquidMetal } from './liquidMetal'

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

const useSpotlight = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      setHoverX(x)
      el.style.setProperty('--spotlight-x', `${x}px`)
    }

    const handleMouseLeave = () => {
      setHoverX(null)
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return { ref, hoverX }
}

export const CreepyLogo = ({ isDark }: { isDark: boolean }) => {
  const eyesRef = useRef<HTMLSpanElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })

  const updateEyes = (e: React.MouseEvent) => {
    if (!eyesRef.current) return
    const rect = eyesRef.current.getBoundingClientRect()
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    const dx = e.clientX - center.x
    const dy = e.clientY - center.y
    const dist = Math.hypot(dx, dy)
    const maxDist = 6
    const scale = Math.min(dist, 100) / 100
    setEyeOffset({
      x: (dx / (dist || 1)) * maxDist * scale,
      y: (dy / (dist || 1)) * maxDist * scale,
    })
  }

  return (
    <div
      className="relative cursor-default select-none"
      onMouseMove={(e) => {
        updateEyes(e)
        if (!isHovered) setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        setEyeOffset({ x: 0, y: 0 })
      }}
    >
      {/* Eyes behind the logo */}
      <span
        ref={eyesRef}
        className="absolute flex items-center gap-[0.35em] right-[0.3em] bottom-[0.1em] h-[0.6em] z-0 pointer-events-none transition-opacity duration-200"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="block bg-black dark:bg-white rounded-full"
            style={{
              width: '0.4em',
              fontSize: '1rem',
              transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
            }}
            animate={{
              height: [
                // 2回まばたき
                '0.4em',
                '0em',
                '0.4em',
                '0.4em',
                '0em',
                '0.4em',
                // 間
                '0.4em',
                // 1回まばたき
                '0em',
                '0.4em',
                // 間
                '0.4em',
              ],
            }}
            transition={{
              duration: 4,
              times: [0, 0.02, 0.06, 0.12, 0.14, 0.18, 0.5, 0.52, 0.56, 1],
              repeat: Infinity,
              delay: 0,
            }}
          />
        ))}
      </span>
      {/* Logo cover that tilts on hover */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        style={{ transformOrigin: 'left bottom' }}
        animate={{ rotate: isHovered ? -10 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <span className="text-2xl font-light tracking-[0.2em] text-secondary font-Montserrat leading-tight">
          TONaRi
        </span>
        <span className="text-[7px] text-gray-400 dark:text-gray-500 tracking-[0.08em] font-light font-Montserrat whitespace-nowrap">
          An AI Agent Standing With You
        </span>
      </motion.div>
    </div>
  )
}

const TaskIconButton = () => {
  const urgentTaskCount = taskStore((s) => s.urgentTaskCount)
  return (
    <button
      onClick={() => taskStore.getState().toggle()}
      className="bg-transparent rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme relative focus:outline-none focus:ring-0"
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

export const Menu = ({ isPortrait }: { isPortrait?: boolean }) => {
  const showControlPanel = settingsStore((s) => s.showControlPanel)
  const isDark = settingsStore((s) => s.colorTheme === 'tonari-dark')
  const uiStyle = settingsStore((s) => s.uiStyle)

  const showSettings = menuStore((s) => s.showSettings)
  const setShowSettings = useCallback(
    (v: boolean) => menuStore.setState({ showSettings: v }),
    []
  )

  // ロングタップ用のステート
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null)

  // モバイルデバイス検出
  const isMobile = useIsMobile()

  const { ref: spotlightRef, hoverX } = useSpotlight()

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
        setShowSettings(!menuStore.getState().showSettings)
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
              <CreepyLogo isDark={isDark} />
              <div
                className="relative rounded-3xl"
                style={{
                  boxShadow:
                    uiStyle === 'neumorphic'
                      ? isDark
                        ? '6px 6px 16px rgba(0,0,0,0.6), -4px -4px 12px rgba(255,255,255,0.04)'
                        : '8px 8px 20px rgba(0,0,0,0.12), -6px -6px 16px rgba(255,255,255,0.9)'
                      : isDark
                        ? '0 4px 24px rgba(0,0,0,0.3)'
                        : '0 4px 24px rgba(0,0,0,0.08)',
                }}
              >
                {/* Neumorphic: top glow accent */}
                {uiStyle === 'neumorphic' && (
                  <div
                    className="absolute -top-2 left-1/4 right-1/4 h-8 z-20 pointer-events-none rounded-full"
                    style={{
                      background: isDark
                        ? 'radial-gradient(ellipse at center, rgba(139,122,171,0.2) 0%, transparent 70%)'
                        : 'radial-gradient(ellipse at center, rgba(200,180,220,0.4) 0%, rgba(255,200,200,0.15) 40%, transparent 70%)',
                      filter: 'blur(6px)',
                    }}
                  />
                )}
                {/* Liquid Metal border frame (glass + light mode only) */}
                {uiStyle === 'glass' && !isDark && (
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
                <div
                  ref={spotlightRef}
                  className={`relative z-10 flex items-center gap-[8px] rounded-3xl px-2 py-1 overflow-hidden ${
                    uiStyle === 'neumorphic'
                      ? isDark
                        ? 'bg-[rgba(20,20,35,0.3)] border border-white/5'
                        : 'bg-white/10 border border-white/60'
                      : uiStyle === 'droplet'
                        ? isDark
                          ? 'bg-[rgba(20,20,35,0.4)] border border-white/[0.06]'
                          : 'bg-white/20 border border-white/40'
                        : 'bg-white/25 dark:bg-[rgba(20,20,35,0.45)] dark:border dark:border-white/10'
                  }`}
                  style={{
                    backdropFilter:
                      uiStyle === 'neumorphic'
                        ? 'blur(8px) saturate(1.2)'
                        : 'blur(16px) saturate(1.6)',
                    WebkitBackdropFilter:
                      uiStyle === 'neumorphic'
                        ? 'blur(8px) saturate(1.2)'
                        : 'blur(16px) saturate(1.6)',
                    boxShadow:
                      uiStyle === 'neumorphic'
                        ? isDark
                          ? 'inset 2px 2px 4px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.03)'
                          : 'inset 2px 2px 5px rgba(0,0,0,0.06), inset -2px -2px 4px rgba(255,255,255,0.8)'
                        : uiStyle === 'droplet'
                          ? isDark
                            ? '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 1px rgba(255,255,255,0.06)'
                            : '0 4px 20px rgba(0,0,0,0.06), inset 0 2px 2px rgba(255,255,255,0.7), inset 0 -2px 2px rgba(255,255,255,0.35)'
                          : isDark
                            ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  {/* Spotlight overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
                    style={{
                      opacity: hoverX !== null ? 1 : 0,
                      background: `radial-gradient(
                        100px circle at var(--spotlight-x, 50%) 50%,
                        ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'} 0%,
                        transparent 70%
                      )`,
                    }}
                  />
                  {showControlPanel ? (
                    <>
                      <IconButton
                        iconName="24/Refresh"
                        isProcessing={false}
                        backgroundColor="bg-transparent"
                        onClick={handleNewSession}
                        aria-label="新しいセッション"
                      />
                      <IconButton
                        iconName="24/Swap"
                        isProcessing={false}
                        backgroundColor="bg-transparent"
                        onClick={handleSwitchVrmModel}
                        aria-label="モデル切り替え"
                      />
                      <IconButton
                        iconName="24/Settings"
                        isProcessing={false}
                        backgroundColor="bg-transparent"
                        onClick={() => setShowSettings(true)}
                        aria-label={t('BasedSettings')}
                      />
                      <Link
                        href="/admin"
                        className="relative z-10 bg-transparent rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme focus:outline-none focus:ring-0"
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
                        backgroundColor="bg-transparent"
                        onClick={() => pomodoroStore.getState().toggle()}
                        aria-label="ポモドーロタイマー"
                      />
                      <TaskIconButton />
                      <button
                        onClick={async () => {
                          await fetch('/api/admin/auth', { method: 'DELETE' })
                          window.location.href = '/login'
                        }}
                        className="relative z-10 bg-transparent rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 text-theme focus:outline-none focus:ring-0"
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
                    <IconButton
                      iconName="24/Timer"
                      isProcessing={false}
                      backgroundColor="bg-transparent"
                      onClick={() => pomodoroStore.getState().toggle()}
                      aria-label="ポモドーロタイマー"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* チャットログ */}
        <div className="flex-1 overflow-hidden">
          <ChatLog isPortrait={isPortrait} />
        </div>
      </div>
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
