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

  // Validate admin session (cookie is sent via same-site lax policy)
  if (!validateAdminToken(req)) {
    return res.redirect(302, '/?google_oauth=unauthorized')
  }

  const { code, error: oauthError } = req.query

  if (oauthError) {
    return res.redirect(302, `/?google_oauth=error&message=${oauthError}`)
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(302, '/?google_oauth=error&message=no_code')
  }

  if (!API_BASE_URL) {
    return res.redirect(302, '/?google_oauth=error&message=api_not_configured')
  }

  try {
    const token = await getCognitoToken()

    // Reconstruct the same redirect_uri used in the auth request
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
        action: 'exchange_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google OAuth exchange error:', response.status, errorText)
      return res.redirect(302, '/?google_oauth=error&message=exchange_failed')
    }

    const data = await response.json()
    if (!data.success) {
      console.error('Google OAuth exchange failed:', data.message)
      return res.redirect(
        302,
        `/?google_oauth=error&message=${encodeURIComponent(data.message)}`
      )
    }

    // Success - redirect back to app
    return res.redirect(302, '/?google_oauth=success')
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return res.redirect(302, '/?google_oauth=error&message=internal_error')
  }
}
