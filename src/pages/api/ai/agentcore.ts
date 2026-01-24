import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import agentcoreConfig from '@/../config/agentcore.json'

// Next.js APIルートの設定（ストリーミング用）
export const config = {
  api: {
    responseLimit: false,
  },
}

// セッションIDを生成（33文字以上必要）
const generateSessionId = () => `scensei-${randomUUID()}-${Date.now()}`

// SSEのdata値からテキストを抽出（JSON文字列またはプレーンテキスト）
function parseJsonString(value: string): string {
  // JSON文字列の場合（"text"形式）
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      // パース失敗時はクォートを除去
      return value.slice(1, -1)
    }
  }
  // プレーンテキストの場合
  return value
}

// Cognito からアクセストークンを取得（M2M client credentials flow）
async function getAccessToken(): Promise<string> {
  const { tokenEndpoint, clientId, scope } = agentcoreConfig.cognito
  // シークレットのみ環境変数から取得
  const clientSecret = process.env.COGNITO_CLIENT_SECRET || ''

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  )

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: scope,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, sessionId } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Cognito からアクセストークンを取得
    const accessToken = await getAccessToken()

    // AgentCore Runtime エンドポイント（設定ファイルから取得）
    const { region, runtimeArn } = agentcoreConfig
    const runtimeSessionId = sessionId || generateSessionId()

    // AgentCore Runtime を直接 HTTP で呼び出し
    // 参考: https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeAgentRuntime.html
    const encodedArn = encodeURIComponent(runtimeArn)
    const endpoint = `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${encodedArn}/invocations`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': runtimeSessionId,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ prompt: message }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AgentCore API error:', response.status, errorText)
      return res.status(response.status).json({ error: errorText })
    }

    // SSEストリーミングレスポンスを設定
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('X-Session-Id', runtimeSessionId)

    // ソケットのバッファリングを無効化
    if (res.socket) {
      res.socket.setNoDelay(true)
    }
    res.flushHeaders()

    // レスポンスボディをストリーミング（SSE形式をパースしてテキストのみ送信）
    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE形式をパース（data: で始まる行を処理）
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 最後の不完全な行をバッファに残す

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith('data:')) {
              // "data:" または "data: " を除去
              let dataValue = trimmedLine.slice(5).trim()
              if (dataValue) {
                // JSON文字列をパースして中身のテキストを取得
                const text = parseJsonString(dataValue)
                if (text) {
                  // SSE形式で送信（data: ...\n\n）
                  res.write(`data: ${JSON.stringify(text)}\n\n`)
                }
              }
            }
          }
        }

        // バッファに残った最後の行を処理
        const trimmedBuffer = buffer.trim()
        if (trimmedBuffer.startsWith('data:')) {
          let dataValue = trimmedBuffer.slice(5).trim()
          if (dataValue) {
            const text = parseJsonString(dataValue)
            if (text) {
              res.write(`data: ${JSON.stringify(text)}\n\n`)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    }

    res.end()
  } catch (error) {
    console.error('AgentCore API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
