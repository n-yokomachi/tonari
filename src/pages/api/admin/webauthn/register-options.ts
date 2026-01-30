import type { NextApiRequest, NextApiResponse } from 'next'
import { generateRegistrationOptions } from '@simplewebauthn/server'

const rpName = 'Scensei Admin'
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 認証済みチェック（Cookieでセッション確認）
  const authCookie = req.cookies['admin_token']
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!authCookie || authCookie !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: 'admin',
      userDisplayName: 'Admin User',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
    })

    // チャレンジをセッションに保存（Cookieで簡易的に）
    res.setHeader(
      'Set-Cookie',
      `webauthn-challenge=${options.challenge}; Path=/; HttpOnly; SameSite=Strict; Max-Age=300`
    )

    return res.status(200).json(options)
  } catch (error) {
    console.error('WebAuthn registration options error:', error)
    return res.status(500).json({ error: 'Failed to generate options' })
  }
}
