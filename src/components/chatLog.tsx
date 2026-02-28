import { useEffect, useRef } from 'react'
import { EMOTIONS } from '@/features/messages/messages'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'

export const ChatLog = ({ isPortrait }: { isPortrait?: boolean }) => {
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)

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
      leftScrollRef.current?.scrollTo({
        top: leftScrollRef.current.scrollHeight,
      })
      rightScrollRef.current?.scrollTo({
        top: rightScrollRef.current.scrollHeight,
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
      leftScrollRef.current?.scrollTo({
        top: leftScrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
      rightScrollRef.current?.scrollTo({
        top: rightScrollRef.current.scrollHeight,
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
    const assistantMessages = messages.filter((msg) => msg.role !== 'user')
    const userMessages = messages.filter((msg) => msg.role === 'user')

    return (
      <div className="h-full w-full grid grid-cols-2 gap-2 px-4 py-2">
        {/* 左列: Tonariのチャット */}
        <div ref={leftScrollRef} className="overflow-y-auto">
          {assistantMessages.map((msg, i) => (
            <div key={i}>
              {typeof msg.content === 'string' ? (
                <Chat
                  role={msg.role}
                  message={msg.content}
                  characterName={characterName}
                  isPortrait
                />
              ) : (
                <>
                  {msg.content?.[0]?.text ? (
                    <Chat
                      role={msg.role}
                      message={msg.content[0].text}
                      characterName={characterName}
                      isPortrait
                    />
                  ) : null}
                  <ChatImage
                    role={msg.role}
                    imageUrl={msg.content ? msg.content[1].image : ''}
                    characterName={characterName}
                    isPortrait
                  />
                </>
              )}
            </div>
          ))}
          {chatProcessing && toolStatusMessage ? (
            <ToolStatusIndicator
              characterName={characterName}
              toolName={
                typeof toolStatusMessage.content === 'string'
                  ? toolStatusMessage.content
                  : ''
              }
              isPortrait
            />
          ) : (
            chatProcessing &&
            (messages.length === 0 ||
              messages[messages.length - 1].role === 'user') && (
              <LoadingIndicator characterName={characterName} isPortrait />
            )
          )}
        </div>
        {/* 右列: オーナーのチャット */}
        <div ref={rightScrollRef} className="overflow-y-auto">
          {userMessages.map((msg, i) => (
            <div key={i}>
              {typeof msg.content === 'string' ? (
                <Chat
                  role={msg.role}
                  message={msg.content}
                  characterName={characterName}
                  isPortrait
                />
              ) : (
                <>
                  {msg.content?.[0]?.text ? (
                    <Chat
                      role={msg.role}
                      message={msg.content[0].text}
                      characterName={characterName}
                      isPortrait
                    />
                  ) : null}
                  <ChatImage
                    role={msg.role}
                    imageUrl={msg.content ? msg.content[1].image : ''}
                    characterName={characterName}
                    isPortrait
                  />
                </>
              )}
            </div>
          ))}
        </div>
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
            ) : (
              <>
                {msg.content?.[0]?.text ? (
                  <Chat
                    role={msg.role}
                    message={msg.content[0].text}
                    characterName={characterName}
                  />
                ) : null}
                <ChatImage
                  role={msg.role}
                  imageUrl={msg.content ? msg.content[1].image : ''}
                  characterName={characterName}
                />
              </>
            )}
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
      <div className="px-6 py-2 rounded-t-lg font-bold tracking-wider bg-white/60 dark:bg-white/15 backdrop-blur-sm text-secondary border-2 border-white/50 dark:border-white/10">
        {characterName || 'CHARACTER'}
      </div>
      <div className="px-6 py-4 bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-b-lg">
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
      <div className="px-6 py-2 rounded-t-lg font-bold tracking-wider bg-white/60 dark:bg-white/15 backdrop-blur-sm text-secondary border-2 border-white/50 dark:border-white/10">
        {characterName || 'CHARACTER'}
      </div>
      <div className="px-6 py-4 bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-b-lg">
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
  const emotionPattern = new RegExp(`\\[(${EMOTIONS.join('|')})\\]\\s*`, 'gi')
  const processedMessage = message.replace(emotionPattern, '')

  const roleColor =
    role !== 'user'
      ? 'bg-white/60 dark:bg-white/15 backdrop-blur-sm text-secondary border-2 border-white/50 dark:border-white/10 '
      : 'bg-white/60 dark:bg-white/15 backdrop-blur-sm text-primary border-2 border-white/50 dark:border-white/10'
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
          <div className="px-6 py-4 bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-b-lg">
            <div className={`font-bold ${roleText}`}>{messageContent}</div>
          </div>
        </>
      )}
    </div>
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
        isPortrait ? 'my-1' : `mx-auto ml-0 md:ml-10 lg:ml-20 my-1 ${offsetX}`
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Sent image"
        className="rounded-lg"
        style={{ maxWidth: 120, maxHeight: 120 }}
      />
    </div>
  )
}
