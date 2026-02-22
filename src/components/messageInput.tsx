import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import homeStore from '@/features/stores/home'
import { IconButton } from './iconButton'
import { CameraPreview, CameraButton } from './cameraPreview'

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
  const [rows, setRows] = useState(1)
  const [fileError, setFileError] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { t } = useTranslation()

  // チャット処理完了後にテキストエリアをフォーカス
  useEffect(() => {
    if (!chatProcessing && textareaRef.current) {
      textareaRef.current.value = ''
      const isTouchDevice = () => {
        if (typeof window === 'undefined') return false
        return (
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          // @ts-expect-error: msMaxTouchPoints is IE-specific
          navigator.msMaxTouchPoints > 0
        )
      }
      if (!isTouchDevice()) {
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
      <div className="bg-base-light text-black">
        <div className="mx-auto max-w-4xl p-4 pb-3">
          {/* エラーメッセージ表示 */}
          {fileError && (
            <div className="mb-2 p-2 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {fileError}
            </div>
          )}
          {/* カメラプレビュー */}
          <CameraPreview />
          {/* 画像プレビュー */}
          {modalImage && (
            <div
              className="mb-2 p-2 bg-gray-100 rounded-lg relative"
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
                className="bg-white hover:bg-white-hover focus:bg-white focus:ring-2 focus:ring-secondary focus:outline-none disabled:bg-gray-100 disabled:text-primary-disabled disabled:cursor-not-allowed rounded-2xl w-full px-4 text-theme-default font-bold transition-all duration-200"
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
              <IconButton
                iconName="24/Send"
                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled disabled:opacity-50 disabled:cursor-not-allowed"
                isProcessing={chatProcessing}
                disabled={chatProcessing || (!userMessage && !modalImage)}
                onClick={onClickSendButton}
                aria-label={t('SendMessage.directSendTitle')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
