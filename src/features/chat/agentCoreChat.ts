export type ToolEvent = { type: 'tool_start' | 'tool_end'; tool?: string }
export type StreamChunk = string | ToolEvent

/**
 * セッションIDを取得（localStorage: ブラウザ単位で永続化）
 * リロードしても同一セッションとして扱われる
 */
const getSessionId = (): string => {
  const key = 'tonari_session_id'
  let sessionId = localStorage.getItem(key)
  if (!sessionId) {
    sessionId = `session-${crypto.randomUUID()}`
    localStorage.setItem(key, sessionId)
  }
  return sessionId
}

/**
 * オーナー固定のアクターIDを返却
 * Tonariはオーナー1人の専属エージェントのため、全端末・全セッションで同一のIDを使用
 */
const getActorId = (): string => {
  return 'tonari-owner'
}

/**
 * セッションIDをリセットして新しいセッションを開始する
 */
export function resetSessionId(): void {
  const key = 'tonari_session_id'
  const newSessionId = `session-${crypto.randomUUID()}`
  localStorage.setItem(key, newSessionId)
}

/**
 * AgentCore APIを呼び出してレスポンスストリームを取得する
 * 会話履歴はAgentCore Memoryが管理するため、最新のユーザーメッセージのみ送信
 */
export async function getAgentCoreChatResponseStream(
  userMessage: string,
  imageBase64?: string
): Promise<ReadableStream<StreamChunk> | null> {
  if (!userMessage && !imageBase64) {
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
      ...(imageBase64 && {
        imageBase64,
        imageFormat: 'jpeg',
      }),
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

  return new ReadableStream<StreamChunk>({
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
                const parsed = JSON.parse(jsonStr)
                if (typeof parsed === 'string') {
                  controller.enqueue(parsed)
                } else if (
                  parsed &&
                  typeof parsed === 'object' &&
                  parsed.type
                ) {
                  controller.enqueue(parsed as ToolEvent)
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
