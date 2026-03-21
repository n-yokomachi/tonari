import type { NextApiRequest, NextApiResponse } from 'next'
import agentcoreConfig from '@/../config/agentcore.json'

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

// Google OAuth callback: Google からリダイレクトされて code を受け取り、
// Lambda で refresh_token に交換して SSM に保存する
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = req.query.code as string | undefined
  if (!code) {
    return res
      .status(400)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          '<p>認証コードが不足しています</p></body></html>'
      )
  }

  // redirect_uri はこのエンドポイント自身（Google に渡したものと一致させる）
  const host = req.headers.host || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/api/ai/google-auth-callback`

  try {
    const accessToken = await getAccessToken()
    const apiUrl = agentcoreConfig.apiUrl

    const response = await fetch(`${apiUrl}/google-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'exchange_code',
        code,
        redirect_uri: redirectUri,
      }),
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
    console.error('Google OAuth callback error:', err)
    return res
      .status(500)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          `<p>Google連携エラー: ${err instanceof Error ? err.message : err}</p></body></html>`
      )
  }
}
