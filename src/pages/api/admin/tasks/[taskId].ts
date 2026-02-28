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

  if (!['GET', 'PUT', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { taskId } = req.query
  if (!taskId || typeof taskId !== 'string') {
    return res.status(400).json({ error: 'taskId is required' })
  }

  if (!API_BASE_URL) {
    return res.status(500).json({ error: 'API設定エラー' })
  }

  try {
    const token = await getCognitoToken()

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }

    if (req.method === 'PUT' && req.body) {
      fetchOptions.body = JSON.stringify(req.body)
    }

    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}`,
      fetchOptions
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Gateway error:', response.status, errorText)
      return res
        .status(response.status)
        .json({ error: 'タスクの操作に失敗しました' })
    }

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    console.error('Failed to operate task:', err)
    return res.status(500).json({ error: 'タスクの操作に失敗しました' })
  }
}
