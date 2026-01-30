import { NextApiRequest, NextApiResponse } from 'next'
import { serialize, parse } from 'cookie'
import crypto from 'crypto'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const COOKIE_NAME = 'admin_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

function generateToken(password: string): string {
  return crypto
    .createHmac('sha256', password)
    .update(Date.now().toString())
    .digest('hex')
}

export function validateAdminToken(req: NextApiRequest): boolean {
  if (!ADMIN_PASSWORD) return false
  const cookies = parse(req.headers.cookie || '')
  const token = cookies[COOKIE_NAME]
  return token === ADMIN_PASSWORD
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { password } = req.body

    if (!ADMIN_PASSWORD) {
      return res
        .status(500)
        .json({ error: '管理者パスワードが設定されていません' })
    }

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'パスワードが正しくありません' })
    }

    res.setHeader(
      'Set-Cookie',
      serialize(COOKIE_NAME, ADMIN_PASSWORD, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      })
    )

    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    res.setHeader(
      'Set-Cookie',
      serialize(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      })
    )

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
