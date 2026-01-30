/**
 * Cognito M2M認証ユーティリティ
 */
import agentcoreConfig from '@/../config/agentcore.json'

let cachedToken: string | null = null
let tokenExpiry: number = 0

/**
 * Cognito からアクセストークンを取得（キャッシュ付き）
 */
export async function getCognitoToken(): Promise<string> {
  // キャッシュが有効ならそれを返す（有効期限5分前まで）
  if (cachedToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken
  }

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

  // トークンをキャッシュ（デフォルト1時間）
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000

  return cachedToken!
}
