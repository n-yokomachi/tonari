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

// Proxy to google-oauth Lambda via API Gateway (M2M auth)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const accessToken = await getAccessToken()
    const apiUrl = agentcoreConfig.apiUrl

    const response = await fetch(`${apiUrl}/google-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(req.body),
    })

    const result = await response.json()
    return res.status(response.status).json(result)
  } catch (error) {
    console.error('Google OAuth API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
