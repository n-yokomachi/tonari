import type { NextApiRequest, NextApiResponse } from 'next'
import { generateAuthenticationOptions } from '@simplewebauthn/server'

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { credentialId } = req.body

  if (!credentialId) {
    return res.status(400).json({ error: 'Credential ID required' })
  }

  try {
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [
        {
          id: credentialId,
        },
      ],
      userVerification: 'required',
    })

    // チャレンジをセッションに保存
    res.setHeader(
      'Set-Cookie',
      `webauthn-challenge=${options.challenge}; Path=/; HttpOnly; SameSite=Strict; Max-Age=300`
    )

    return res.status(200).json(options)
  } catch (error) {
    console.error('WebAuthn auth options error:', error)
    return res.status(500).json({ error: 'Failed to generate options' })
  }
}
