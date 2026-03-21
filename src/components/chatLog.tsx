import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'

export const ChatLog = ({ isPortrait }: { isPortrait?: boolean }) => {
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const portraitScrollRef = useRef<HTMLDivElement>(null)

  const characterName = settingsStore((s) => s.characterName)
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const messages = messageSelectors.getTextAndImageMessages(
    homeStore((s) => s.chatLog)
  )
  const toolStatusMessage = homeStore((s) =>
    s.chatLog.find((msg) => msg.role === 'tool-status')
  )

  useEffect(() => {
    if (isPortrait) {
      portraitScrollRef.current?.scrollTo({
        top: portraitScrollRef.current.scrollHeight,
      })
    } else {
      chatScrollRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'center',
      })
    }
  }, [isPortrait])

  useEffect(() => {
    if (isPortrait) {
      portraitScrollRef.current?.scrollTo({
        top: portraitScrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    } else {
      chatScrollRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [messages, chatProcessing, toolStatusMessage, isPortrait])

  if (isPortrait) {
    return (
      <div
        ref={portraitScrollRef}
        className="h-full w-full overflow-y-auto px-4 py-2"
      >
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'ml-8' : 'mr-8'}>
            {typeof msg.content === 'string' ? (
              <Chat
                role={msg.role}
                message={msg.content}
                characterName={characterName}
                isPortrait
              />
            ) : Array.isArray(msg.content) ? (
              <>
                {msg.content.map((block, j) => {
                  if (block.type === 'text' && block.text) {
                    return (
                      <Chat
                        key={j}
                        role={msg.role}
                        message={block.text}
                        characterName={characterName}
                        isPortrait
                      />
                    )
                  }
                  if (block.type === 'image' && block.image) {
                    const src =
                      block.image.startsWith('data:') ||
                      block.image.startsWith('http')
                        ? block.image
                        : `data:image/png;base64,${block.image}`
                    return (
                      <ChatImage
                        key={j}
                        role={msg.role}
                        imageUrl={src}
                        characterName={characterName}
                        isPortrait
                      />
                    )
                  }
                  return null
                })}
              </>
            ) : null}
          </div>
        ))}
        {chatProcessing && toolStatusMessage ? (
          <div className="mr-8">
            <ToolStatusIndicator
              characterName={characterName}
              toolName={
                typeof toolStatusMessage.content === 'string'
                  ? toolStatusMessage.content
                  : ''
              }
              isPortrait
            />
          </div>
        ) : (
          chatProcessing &&
          (messages.length === 0 ||
            messages[messages.length - 1].role === 'user') && (
            <div className="mr-8">
              <LoadingIndicator characterName={characterName} isPortrait />
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => {
        return (
          <div
            key={i}
            ref={
              messages.length - 1 === i && !chatProcessing
                ? chatScrollRef
                : null
            }
          >
            {typeof msg.content === 'string' ? (
              <Chat
                role={msg.role}
                message={msg.content}
                characterName={characterName}
              />
            ) : Array.isArray(msg.content) ? (
              <>
                {msg.content.map((block, j) => {
                  if (block.type === 'text' && block.text) {
                    return (
                      <Chat
                        key={j}
                        role={msg.role}
                        message={block.text}
                        characterName={characterName}
                      />
                    )
                  }
                  if (block.type === 'image' && block.image) {
                    const src =
                      block.image.startsWith('data:') ||
                      block.image.startsWith('http')
                        ? block.image
                        : `data:image/png;base64,${block.image}`
                    return (
                      <ChatImage
                        key={j}
                        role={msg.role}
                        imageUrl={src}
                        characterName={characterName}
                      />
                    )
                  }
                  return null
                })}
              </>
            ) : null}
          </div>
        )
      })}
      {chatProcessing && toolStatusMessage ? (
        <div ref={chatScrollRef}>
          <ToolStatusIndicator
            characterName={characterName}
            toolName={
              typeof toolStatusMessage.content === 'string'
                ? toolStatusMessage.content
                : ''
            }
          />
        </div>
      ) : (
        chatProcessing &&
        (messages.length === 0 ||
          messages[messages.length - 1].role === 'user') && (
          <div ref={chatScrollRef}>
            <LoadingIndicator characterName={characterName} />
          </div>
        )
      )}
    </div>
  )
}

const LoadingIndicator = ({
  characterName,
  isPortrait,
}: {
  characterName: string
  isPortrait?: boolean
}) => {
  return (
    <div
      className={
        isPortrait ? 'my-2' : 'mx-auto ml-0 md:ml-10 lg:ml-20 my-4 pr-10'
      }
    >
      <div className="px-6 py-2 rounded-t-lg font-bold tracking-wider bg-white/60 dark:bg-black/60 backdrop-blur-sm text-secondary border-2 border-white/50 dark:border-white/10">
        {characterName || 'CHARACTER'}
      </div>
      <div className="px-6 py-4 bg-white/70 dark:bg-black/50 backdrop-blur-sm rounded-b-lg">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 bg-secondary rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-secondary rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-secondary rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}

const ToolStatusIndicator = ({
  characterName,
  toolName,
  isPortrait,
}: {
  characterName: string
  toolName: string
  isPortrait?: boolean
}) => {
  return (
    <div
      className={
        isPortrait ? 'my-2' : 'mx-auto ml-0 md:ml-10 lg:ml-20 my-4 pr-10'
      }
    >
      <div className="px-6 py-2 rounded-t-lg font-bold tracking-wider bg-white/60 dark:bg-black/60 backdrop-blur-sm text-secondary border-2 border-white/50 dark:border-white/10">
        {characterName || 'CHARACTER'}
      </div>
      <div className="px-6 py-4 bg-white/70 dark:bg-black/50 backdrop-blur-sm rounded-b-lg">
        <div className="flex items-center gap-2 animate-pulse">
          <span className="text-base">&#128295;</span>
          <span className="text-secondary font-bold">{toolName}...</span>
        </div>
      </div>
    </div>
  )
}

// リンクタグをパースしてReact要素に変換
const parseLinks = (text: string): React.ReactNode[] => {
  const linkPattern = /\[link:(\/[^\]]+)\]([^\[]+)\[\/link\]/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = linkPattern.exec(text)) !== null) {
    // マッチ前のテキスト
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // リンク要素
    const path = match[1]
    const linkText = match[2]
    parts.push(
      <a
        key={match.index}
        href={path}
        className="text-secondary underline hover:text-secondary-hover transition-colors"
      >
        {linkText}
      </a>
    )

    lastIndex = match.index + match[0].length
  }

  // 残りのテキスト
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

// テキスト内の画像URLを抽出する
const IMAGE_URL_PATTERN =
  /https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s"'<>]*)?/gi

const extractImageUrls = (
  text: string
): { cleanText: string; urls: string[] } => {
  const urls: string[] = []
  const cleanText = text.replace(IMAGE_URL_PATTERN, (match) => {
    urls.push(match)
    return ''
  })
  return { cleanText: cleanText.replace(/\s+/g, ' ').trim(), urls }
}

const Chat = ({
  role,
  message,
  characterName,
  isPortrait,
}: {
  role: string
  message: string
  characterName: string
  isPortrait?: boolean
}) => {
  // 画像URLをテキストから抽出
  const { cleanText: textWithoutImages, urls: imageUrls } =
    extractImageUrls(message)

  const processedMessage = textWithoutImages
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const roleColor =
    role !== 'user'
      ? 'bg-white/60 dark:bg-black/60 backdrop-blur-sm text-secondary border-2 border-white/50 dark:border-white/10 '
      : 'bg-white/60 dark:bg-black/60 backdrop-blur-sm text-primary border-2 border-white/50 dark:border-white/10'
  const roleText = role !== 'user' ? 'text-secondary' : 'text-primary'
  const offsetX = role === 'user' ? 'pl-10' : 'pr-10'

  // リンクタグをパースしてReact要素に変換
  const messageContent = parseLinks(processedMessage)

  return (
    <div
      className={
        isPortrait ? 'my-2' : `mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`
      }
    >
      {role === 'code' ? (
        <pre className="whitespace-pre-wrap break-words bg-[#1F2937] text-theme p-4 rounded-lg">
          <code className="font-mono text-sm">{message}</code>
        </pre>
      ) : (
        <>
          <div
            className={`px-6 py-2 rounded-t-lg font-bold tracking-wider ${roleColor}`}
          >
            {role !== 'user' ? characterName || 'CHARACTER' : 'YOU'}
          </div>
          <div className="px-6 py-4 bg-white/70 dark:bg-black/50 backdrop-blur-sm rounded-b-lg">
            {processedMessage && (
              <div className={`font-bold whitespace-pre-wrap ${roleText}`}>
                {messageContent}
              </div>
            )}
            {imageUrls.map((url, idx) => (
              <ExpandableImage
                key={idx}
                src={url}
                alt={`Generated image ${idx + 1}`}
                className="mt-2"
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const ExpandableImage = ({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        style={{ maxWidth: '100%', maxHeight: 400 }}
        onClick={() => setIsExpanded(true)}
      />
      {isExpanded &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  )
}

const ChatImage = ({
  role,
  imageUrl,
  isPortrait,
}: {
  role: string
  imageUrl: string
  characterName: string
  isPortrait?: boolean
}) => {
  const offsetX = role === 'user' ? 'pl-10' : 'pr-10'

  return (
    <div
      className={
        isPortrait ? 'my-2' : `mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`
      }
    >
      <ExpandableImage src={imageUrl} alt="Sent image" />
    </div>
  )
}
