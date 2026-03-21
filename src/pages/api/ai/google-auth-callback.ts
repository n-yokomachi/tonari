import type { NextApiRequest, NextApiResponse } from 'next'
import agentcoreConfig from '@/../config/agentcore.json'

// Cognito M2M token (same as agentcore.ts)
async function getAccessToken(): Promise<string> {
  const { tokenEndpoint, clientId, scope } = agentcoreConfig.cognito
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

// Google OAuth callback: AgentCore Identity OAuth flow completion
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionId = req.query.session_id as string | undefined
  if (!sessionId) {
    return res
      .status(400)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          '<p>session_id が不足しています</p></body></html>'
      )
  }

  try {
    const accessToken = await getAccessToken()

    const apiUrl = agentcoreConfig.apiUrl
    const response = await fetch(`${apiUrl}/google-oauth-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ session_uri: sessionId }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || `API error: ${response.status}`)
    }

    return res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          '<p>Google連携が完了しました！このタブを閉じてOKです。</p></body></html>'
      )
  } catch (err) {
    console.error('CompleteResourceTokenAuth error:', err)
    return res
      .status(500)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          `<p>Google連携エラー: ${err instanceof Error ? err.message : err}</p></body></html>`
      )
  }
}
