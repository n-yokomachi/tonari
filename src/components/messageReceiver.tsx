import { useEffect, useState, useCallback } from 'react'
import {
  speakMessageHandler,
  processAIResponse,
  handleSendChatFn,
} from '@/features/chat/handlers'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'

class ReceivedMessage {
  timestamp: number
  message: string
  type: 'direct_send' | 'ai_generate' | 'user_input'

  constructor(
    timestamp: number,
    message: string,
    type: 'direct_send' | 'ai_generate' | 'user_input'
  ) {
    this.timestamp = timestamp
    this.message = message
    this.type = type
  }
}

const MessageReceiver = () => {
  const [lastTimestamp, setLastTimestamp] = useState(0)
  const clientId = settingsStore((state) => state.clientId)
  const handleSendChat = handleSendChatFn()

  const speakMessage = useCallback(
    async (messages: ReceivedMessage[]) => {
      for (const message of messages) {
        switch (message.type) {
          case 'direct_send':
            await speakMessageHandler(message.message)
            break
          case 'ai_generate': {
            // ユーザーメッセージをチャットログに追加（画面表示用）
            homeStore.getState().upsertMessage({
              role: 'user',
              content: message.message,
              timestamp: new Date().toISOString(),
            })
            // 会話履歴はAgentCore Memoryが管理するため、最新のユーザーメッセージのみ送信
            await processAIResponse(message.message)
            break
          }
          case 'user_input': {
            // handleSendChatFnを使用してメッセージを送信
            await handleSendChat(message.message)
            break
          }
          default:
            console.error('Invalid message type:', message.type)
        }
      }
    },
    [handleSendChat]
  )

  useEffect(() => {
    if (!clientId) return

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `/api/messages?lastTimestamp=${lastTimestamp}&clientId=${clientId}`
        )
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          speakMessage(data.messages)
          const newLastTimestamp =
            data.messages[data.messages.length - 1].timestamp
          setLastTimestamp(newLastTimestamp)
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      }
    }

    fetchMessages()
    const intervalId = setInterval(fetchMessages, 1000)

    return () => clearInterval(intervalId)
  }, [clientId, lastTimestamp, speakMessage])

  return <></>
}

export default MessageReceiver
