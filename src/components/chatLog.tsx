import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { EMOTIONS } from '@/features/messages/messages'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'

export const ChatLog = () => {
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const characterName = settingsStore((s) => s.characterName)
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const messages = messageSelectors.getTextAndImageMessages(
    homeStore((s) => s.chatLog)
  )

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    })
  }, [])

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [messages, chatProcessing])

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
                <Chat
                  role={msg.role}
                  message={msg.content ? msg.content[0].text : ''}
                  characterName={characterName}
                />
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
      {chatProcessing &&
        (messages.length === 0 ||
          messages[messages.length - 1].role === 'user') && (
          <div ref={chatScrollRef}>
            <LoadingIndicator characterName={characterName} />
          </div>
        )}
    </div>
  )
}

const LoadingIndicator = ({ characterName }: { characterName: string }) => {
  return (
    <div className="mx-auto ml-0 md:ml-10 lg:ml-20 my-4 pr-10">
      <div className="px-6 py-2 rounded-t-lg font-bold tracking-wider bg-secondary text-theme">
        {characterName || 'CHARACTER'}
      </div>
      <div className="px-6 py-4 bg-white rounded-b-lg">
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

const Chat = ({
  role,
  message,
  characterName,
}: {
  role: string
  message: string
  characterName: string
}) => {
  const emotionPattern = new RegExp(`\\[(${EMOTIONS.join('|')})\\]\\s*`, 'gi')
  const processedMessage = message.replace(emotionPattern, '')

  const roleColor =
    role !== 'user' ? 'bg-secondary text-theme ' : 'bg-base-light text-primary'
  const roleText = role !== 'user' ? 'text-secondary' : 'text-primary'
  const offsetX = role === 'user' ? 'pl-10' : 'pr-10'

  return (
    <div className={`mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`}>
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
          <div className="px-6 py-4 bg-white rounded-b-lg">
            <div className={`font-bold ${roleText}`}>{processedMessage}</div>
          </div>
        </>
      )}
    </div>
  )
}

const ChatImage = ({
  role,
  imageUrl,
  characterName,
}: {
  role: string
  imageUrl: string
  characterName: string
}) => {
  const offsetX = role === 'user' ? 'pl-40' : 'pr-40'

  return (
    <div className={`mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`}>
      <Image
        src={imageUrl}
        alt="Generated Image"
        className="rounded-lg"
        width={512}
        height={512}
      />
    </div>
  )
}
