import { NextApiRequest, NextApiResponse } from 'next'
import { validateAdminToken } from '../auth'
import { getCognitoToken } from '@/lib/cognito'

const API_BASE_URL = process.env.PERFUME_API_URL || ''

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateAdminToken(req)) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!API_BASE_URL) {
    console.error('PERFUME_API_URL is not configured')
    return res.status(500).json({ error: 'API設定エラー' })
  }

  try {
    const token = await getCognitoToken()

    const response = await fetch(`${API_BASE_URL}/diaries`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Gateway error:', response.status, errorText)
      return res
        .status(response.status)
        .json({ error: '日記の取得に失敗しました' })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error('Failed to fetch diaries:', err)
    return res.status(500).json({ error: '日記の取得に失敗しました' })
  }
}
