import type { NextApiRequest, NextApiResponse } from 'next'
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
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

  // 認証済みチェック
  const authCookie = req.cookies['admin_token']
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!authCookie || authCookie !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const challenge = req.cookies['webauthn-challenge']
  if (!challenge) {
    return res.status(400).json({ error: 'Challenge not found' })
  }

  try {
    const response: RegistrationResponseJSON = req.body

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (verification.verified && verification.registrationInfo) {
      // クレデンシャル情報を返す（クライアントでlocalStorageに保存）
      const { credential } = verification.registrationInfo

      // チャレンジCookieを削除
      res.setHeader(
        'Set-Cookie',
        'webauthn-challenge=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
      )

      return res.status(200).json({
        verified: true,
        credential: {
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64'),
          counter: credential.counter,
        },
      })
    }

    return res.status(400).json({ error: 'Verification failed' })
  } catch (error) {
    console.error('WebAuthn registration verify error:', error)
    return res.status(500).json({ error: 'Verification failed' })
  }
}
