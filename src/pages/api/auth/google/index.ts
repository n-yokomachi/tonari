import { NextApiRequest, NextApiResponse } from 'next'
import { validateAdminToken } from '../../admin/auth'
import { getCognitoToken } from '@/lib/cognito'

const API_BASE_URL = process.env.PERFUME_API_URL || ''

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!validateAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!API_BASE_URL) {
    return res.status(500).json({ error: 'API not configured' })
  }

  try {
    const token = await getCognitoToken()

    // Determine callback URL from request
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`

    const response = await fetch(`${API_BASE_URL}/google-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'get_auth_url',
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google OAuth API error:', response.status, errorText)
      return res.status(500).json({ error: 'Failed to get auth URL' })
    }

    const data = await response.json()
    if (!data.success) {
      return res.status(500).json({ error: data.message })
    }

    // Redirect browser to Google OAuth consent screen
    return res.redirect(302, data.auth_url)
  } catch (error) {
    console.error('Google OAuth error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
