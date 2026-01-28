/**
 * セッションIDを取得（localStorage: ブラウザ単位で永続化）
 * リロードしても同一セッションとして扱われる
 */
const getSessionId = (): string => {
  const key = 'scensei_session_id'
  let sessionId = localStorage.getItem(key)
  if (!sessionId) {
    sessionId = `session-${crypto.randomUUID()}`
    localStorage.setItem(key, sessionId)
  }
  return sessionId
}

/**
 * アクターIDを取得（localStorage: ブラウザ単位で永続化）
 * LTM（長期記憶）でユーザーを識別するためのID
 * セッションを跨いでも同一ユーザーとして記憶される
 */
const getActorId = (): string => {
  const key = 'scensei_actor_id'
  let actorId = localStorage.getItem(key)
  if (!actorId) {
    actorId = `user-${crypto.randomUUID()}`
    localStorage.setItem(key, actorId)
  }
  return actorId
}

/**
 * AgentCore APIを呼び出してレスポンスストリームを取得する
 * 会話履歴はAgentCore Memoryが管理するため、最新のユーザーメッセージのみ送信
 */
export async function getAgentCoreChatResponseStream(
  userMessage: string
): Promise<ReadableStream<string> | null> {
  if (!userMessage) {
    return null
  }

  const response = await fetch('/api/ai/agentcore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: userMessage,
      sessionId: getSessionId(),
      actorId: getActorId(),
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
