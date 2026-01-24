import { Message } from '@/features/messages/messages'

/**
 * AgentCore APIを呼び出してレスポンスストリームを取得する
 */
export async function getAgentCoreChatResponseStream(
  messages: Message[]
): Promise<ReadableStream<string> | null> {
  // 最新のユーザーメッセージを取得
  const userMessages = messages.filter((m) => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]

  if (!lastUserMessage) {
    return null
  }

  const response = await fetch('/api/ai/agentcore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: lastUserMessage.content,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AgentCore API error: ${response.status} - ${errorText}`)
  }

  // ストリーミングレスポンスをReadableStream<string>に変換
  const reader = response.body?.getReader()
  if (!reader) {
    return null
  }

  const decoder = new TextDecoder()
  let sseBuffer = ''

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()

        if (done) {
          controller.close()
          reader.releaseLock()
          return
        }

        // SSE形式をパース
        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || '' // 最後の不完全な行をバッファに残す

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith('data:')) {
            const jsonStr = trimmedLine.slice(5).trim()
            if (jsonStr) {
              try {
                const text = JSON.parse(jsonStr)
                if (typeof text === 'string') {
                  controller.enqueue(text)
                }
              } catch {
                // パース失敗時はそのまま
                controller.enqueue(jsonStr)
              }
            }
          }
        }
      } catch (error) {
        controller.error(error)
        reader.releaseLock()
      }
    },
    cancel() {
      reader.releaseLock()
    },
  })
}
