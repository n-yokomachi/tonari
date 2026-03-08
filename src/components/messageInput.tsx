import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { IconButton } from './iconButton'
import { CameraPreview, CameraButton } from './cameraPreview'
import { LiquidMetal } from './liquidMetal'

const SendButton = ({
  isActive,
  isProcessing,
  disabled,
  isDark,
  uiStyle,
  onClick,
  ariaLabel,
}: {
  isActive: boolean
  isProcessing: boolean
  disabled: boolean
  isDark: boolean
  uiStyle: 'glass' | 'neumorphic' | 'droplet'
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  ariaLabel: string
}) => {
  if (uiStyle === 'droplet') {
    return (
      <button
        className={`rounded-full text-sm p-2.5 text-center inline-flex items-center focus:outline-none focus:ring-0 transition-all duration-300 ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
        style={{
          background: isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(255,255,255,0.15)',
          border: isDark
            ? '1px solid rgba(255,255,255,0.06)'
            : '1px solid rgba(255,255,255,0.4)',
          boxShadow: isActive
            ? isDark
              ? '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(255,255,255,0.06)'
              : '0 2px 12px rgba(0,0,0,0.08), inset 0 2px 2px rgba(255,255,255,0.7), inset 0 -2px 2px rgba(255,255,255,0.35)'
            : isDark
              ? '0 1px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(255,255,255,0.04)'
              : '0 1px 6px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(255,255,255,0.3)',
        }}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        <Image
          src="/images/icons/send.svg"
          alt={ariaLabel}
          width={24}
          height={24}
          priority
          unoptimized
          className={`transition-all duration-300 ${isProcessing ? 'animate-pulse' : ''} ${
            isActive
              ? isDark
                ? 'brightness-200'
                : 'brightness-0'
              : isDark
                ? 'brightness-150 opacity-40'
                : 'opacity-30'
          }`}
        />
      </button>
    )
  }

  return (
    <div className="relative">
      {/* Glow layer */}
      <div className={`gold-ring-glow ${isActive ? 'active' : ''}`} />
      {/* Clip container + rotating gradient */}
      <div className="gold-ring-clip">
        <div className={`gold-ring-gradient ${isActive ? 'active' : ''}`} />
      </div>
      {/* Inner plate - matches glass container when inactive */}
      <div
        className="gold-ring-inner transition-colors duration-300"
        style={{
          backgroundColor: isActive
            ? isDark
              ? 'rgba(20,20,35,0.95)'
              : 'rgba(255,255,255,0.9)'
            : 'transparent',
        }}
      />
      {/* Button */}
      <button
        className={`relative z-10 rounded-[10px] text-sm p-2 text-center inline-flex items-center focus:outline-none focus:ring-0 transition-all duration-300 border ${
          isActive
            ? isDark
              ? 'bg-white/40 hover:bg-white/50 active:bg-white/55 border-transparent'
              : 'bg-black/5 hover:bg-black/10 active:bg-black/15 border-transparent'
            : isDark
              ? 'bg-white/5 border-white/10'
              : 'bg-white/30 border-black/5'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        <Image
          src="/images/icons/send.svg"
          alt={ariaLabel}
          width={24}
          height={24}
          priority
          unoptimized
          className={`transition-all duration-300 ${isProcessing ? 'animate-pulse' : ''} ${
            isActive
              ? 'brightness-200'
              : isDark
                ? 'brightness-150 opacity-40'
                : 'opacity-30'
          }`}
        />
      </button>
    </div>
  )
}

// ファイルバリデーションの設定
const FILE_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ],
  maxImageDimensions: { width: 4096, height: 4096 },
} as const

type Props = {
  userMessage: string
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void
  onClickSendButton: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export const MessageInput = ({
  userMessage,
  onChangeUserMessage,
  onClickSendButton,
}: Props) => {
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const modalImage = homeStore((s) => s.modalImage)
  const isDark = settingsStore((s) => s.colorTheme === 'tonari-dark')
  const uiStyle = settingsStore((s) => s.uiStyle)
  const [rows, setRows] = useState(1)
  const [fileError, setFileError] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { t } = useTranslation()

  // チャット処理完了後にテキストエリアをフォーカス（PC のみ）
  useEffect(() => {
    if (!chatProcessing && textareaRef.current) {
      const isMobile =
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.innerWidth <= 768
      if (!isMobile) {
        textareaRef.current.focus()
      }
    }
  }, [chatProcessing])

  // テキスト内容に基づいて適切な行数を計算
  const calculateRows = useCallback((text: string): number => {
    const MIN_ROWS = 1
    const MAX_ROWS = 5
    const CHARS_PER_LINE = 50
    const lines = text.split('\n')

    const baseRows = Math.max(MIN_ROWS, lines.length)

    const extraRows = lines.reduce((acc, line) => {
      const lineRows = Math.ceil(line.length / CHARS_PER_LINE)
      return acc + Math.max(0, lineRows - 1)
    }, 0)

    return Math.min(MAX_ROWS, baseRows + extraRows)
  }, [])

  // userMessageの変更に応じて行数を調整
  useEffect(() => {
    const newRows = calculateRows(userMessage)
    setRows(newRows)
  }, [userMessage, calculateRows])

  // 共通の遅延行数更新処理
  const updateRowsWithDelay = useCallback(
    (target: HTMLTextAreaElement) => {
      setTimeout(() => {
        const newRows = calculateRows(target.value)
        setRows(newRows)
      }, 0)
    },
    [calculateRows]
  )

  // テキストエリアの内容変更時の処理
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value
    const newRows = calculateRows(newText)
    setRows(newRows)
    onChangeUserMessage(event)
  }

  // ファイルバリデーション関数
  const validateFile = useCallback(
    (file: File): { isValid: boolean; error?: string } => {
      if (file.size > FILE_VALIDATION.maxSizeBytes) {
        return {
          isValid: false,
          error: t('FileSizeError', {
            maxSize: Math.round(FILE_VALIDATION.maxSizeBytes / (1024 * 1024)),
          }),
        }
      }

      if (!FILE_VALIDATION.allowedTypes.includes(file.type as any)) {
        return {
          isValid: false,
          error: t('FileTypeError'),
        }
      }

      return { isValid: true }
    },
    [t]
  )

  // 画像の寸法をチェックする関数
  const validateImageDimensions = useCallback(
    (imageElement: HTMLImageElement): boolean => {
      return (
        imageElement.naturalWidth <= FILE_VALIDATION.maxImageDimensions.width &&
        imageElement.naturalHeight <= FILE_VALIDATION.maxImageDimensions.height
      )
    },
    []
  )

  // 画像を処理する関数
  const processImageFile = useCallback(
    async (file: File): Promise<void> => {
      setFileError('')

      const validation = validateFile(file)
      if (!validation.isValid) {
        setFileError(validation.error || 'Unknown error')
        return
      }

      try {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64Image = e.target?.result as string

          const img = document.createElement('img')
          img.onload = () => {
            if (!validateImageDimensions(img)) {
              setFileError(
                t('ImageDimensionError', {
                  maxWidth: FILE_VALIDATION.maxImageDimensions.width,
                  maxHeight: FILE_VALIDATION.maxImageDimensions.height,
                })
              )
              return
            }
            homeStore.setState({ modalImage: base64Image })
          }
          img.onerror = () => {
            setFileError(t('ImageLoadError'))
          }
          img.src = base64Image
        }
        reader.onerror = () => {
          setFileError(t('FileReadError'))
        }
        reader.readAsDataURL(file)
      } catch (error) {
        setFileError(t('FileProcessError'))
      }
    },
    [validateFile, validateImageDimensions, t]
  )

  // 画像を削除する関数
  const handleRemoveImage = useCallback(() => {
    homeStore.setState({ modalImage: '' })
    setFileError('')
  }, [])

  // クリップボードからの画像ペースト処理
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = event.clipboardData
      if (!clipboardData) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
        return
      }

      const items = clipboardData.items
      let hasImage = false

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await processImageFile(file)
            hasImage = true
          }
          break
        }
      }

      if (!hasImage) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
      }
    },
    [processImageFile, updateRowsWithDelay]
  )

  // ドラッグ＆ドロップ処理
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const files = event.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          await processImageFile(file)
        } else {
          setFileError(t('FileTypeError'))
        }
      }
    },
    [processImageFile, t]
  )

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !event.nativeEvent.isComposing &&
      event.code !== 'Backquote' &&
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()
      if (userMessage.trim() !== '' || modalImage) {
        onClickSendButton(
          event as unknown as React.MouseEvent<HTMLButtonElement>
        )
        setRows(1)
      }
    } else if (event.key === 'Enter' && event.shiftKey) {
      updateRowsWithDelay(event.target as HTMLTextAreaElement)
    } else if (
      event.key === 'Backspace' &&
      rows > 1 &&
      userMessage.slice(-1) === '\n'
    ) {
      updateRowsWithDelay(event.target as HTMLTextAreaElement)
    }
  }

  return (
    <div className="w-full flex-shrink-0">
      <div className="relative">
        {/* Liquid Metal top border only (glass + light mode only) */}
        {uiStyle === 'glass' && !isDark && (
          <div
            className="absolute top-0 left-0 right-0 h-[40px] z-20 pointer-events-none"
            style={{ clipPath: 'inset(0 0 calc(100% - 2px) 0)' }}
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
          className={`text-black dark:text-gray-200 ${
            uiStyle === 'neumorphic'
              ? isDark
                ? 'bg-[rgba(20,20,35,0.3)] border-t border-white/5'
                : 'bg-white/10 border-t border-white/60'
              : uiStyle === 'droplet'
                ? isDark
                  ? 'bg-[rgba(20,20,35,0.4)] border-t border-white/[0.06]'
                  : 'bg-white/20 border-t border-white/40'
                : 'bg-white/25 dark:bg-[rgba(20,20,35,0.45)]'
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
                  ? '0 -6px 16px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 3px rgba(255,255,255,0.03)'
                  : '0 -8px 20px rgba(0,0,0,0.08), inset 0 2px 5px rgba(0,0,0,0.04), inset 0 -2px 4px rgba(255,255,255,0.8)'
                : uiStyle === 'droplet'
                  ? isDark
                    ? '0 -4px 20px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 1px rgba(255,255,255,0.06)'
                    : '0 -4px 20px rgba(0,0,0,0.06), inset 0 2px 2px rgba(255,255,255,0.7), inset 0 -2px 2px rgba(255,255,255,0.35)'
                  : isDark
                    ? '0 -4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 -4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          <div className="mx-auto max-w-4xl px-4 pt-3 pb-2">
            {/* エラーメッセージ表示 */}
            {fileError && (
              <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {fileError}
              </div>
            )}
            {/* カメラプレビュー */}
            <CameraPreview />
            {/* 画像プレビュー */}
            {modalImage && (
              <div
                className="mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg relative"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 text-red-500 hover:text-red-700 text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50"
                >
                  ×
                </button>
                <Image
                  src={modalImage}
                  alt="Pasted image"
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="max-w-full max-h-32 rounded object-contain w-auto h-auto"
                />
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  placeholder=""
                  onChange={handleTextChange}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyPress}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  disabled={chatProcessing}
                  className="bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/15 focus:bg-white/70 dark:focus:bg-white/20 focus:ring-2 focus:ring-secondary focus:outline-none disabled:bg-gray-100/50 dark:disabled:bg-gray-800/50 disabled:text-primary-disabled disabled:cursor-not-allowed rounded-2xl w-full px-4 text-theme-default font-bold transition-all duration-200"
                  value={userMessage}
                  rows={rows}
                  aria-label={t('EnterYourQuestion')}
                  style={{
                    lineHeight: '1.5',
                    padding: '8px 16px',
                    resize: 'none',
                    whiteSpace: 'pre-wrap',
                  }}
                ></textarea>
              </div>
              <div className="flex-shrink-0 pb-[0.3rem]">
                <CameraButton />
              </div>
              <div className="flex-shrink-0 pb-[0.3rem]">
                <SendButton
                  isActive={!chatProcessing && !!(userMessage || modalImage)}
                  isProcessing={chatProcessing}
                  disabled={chatProcessing || (!userMessage && !modalImage)}
                  isDark={isDark}
                  uiStyle={uiStyle}
                  onClick={onClickSendButton}
                  ariaLabel={t('SendMessage.directSendTitle')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
