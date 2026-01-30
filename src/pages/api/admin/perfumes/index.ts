import { NextApiRequest, NextApiResponse } from 'next'
import { validateAdminToken } from '../auth'
import { getCognitoToken } from '@/lib/cognito'

// API Gateway URL (デプロイ後に設定)
const API_BASE_URL = process.env.PERFUME_API_URL || ''

export interface Perfume {
  brand: string
  name: string
  country: string
  topNotes: string[]
  middleNotes: string[]
  baseNotes: string[]
  scenes: string[]
  seasons: string[]
  impression: string
  rating: number
  createdAt: string
  updatedAt: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateAdminToken(req)) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  // API Gateway URLが設定されていない場合はエラー
  if (!API_BASE_URL) {
    console.error('PERFUME_API_URL is not configured')
    return res.status(500).json({ error: 'API設定エラー' })
  }

  try {
    // Cognito トークン取得
    const token = await getCognitoToken()

    if (req.method === 'GET') {
      const response = await fetch(`${API_BASE_URL}/perfumes`, {
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
          .json({ error: 'データの取得に失敗しました' })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const response = await fetch(`${API_BASE_URL}/perfumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(req.body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Gateway error:', response.status, errorText)
        return res
          .status(response.status)
          .json({ error: 'データの作成に失敗しました' })
      }

      const data = await response.json()
      return res.status(201).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({ error: '内部エラーが発生しました' })
  }
}
