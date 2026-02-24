import type { NextApiRequest, NextApiResponse } from 'next'
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server'

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const challenge = req.cookies['webauthn-challenge']
  if (!challenge) {
    return res.status(400).json({ error: 'Challenge not found' })
  }

  const { response, credential } = req.body as {
    response: AuthenticationResponseJSON
    credential: {
      id: string
      publicKey: string
      counter: number
    }
  }

  if (!response || !credential) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64')),
        counter: credential.counter,
      },
    })

    if (verification.verified) {
      const adminPassword = process.env.ADMIN_PASSWORD
      const isProduction = process.env.NODE_ENV === 'production'
      // チャレンジCookieを削除し、認証Cookieを設定
      res.setHeader('Set-Cookie', [
        'webauthn-challenge=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        `auth_token=${adminPassword}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}${isProduction ? '; Secure' : ''}`,
      ])

      return res.status(200).json({
        verified: true,
        newCounter: verification.authenticationInfo.newCounter,
      })
    }

    return res.status(400).json({ error: 'Verification failed' })
  } catch (error) {
    console.error('WebAuthn auth verify error:', error)
    return res.status(500).json({ error: 'Verification failed' })
  }
}
