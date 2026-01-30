import { NextApiRequest, NextApiResponse } from 'next'
import { validateAdminToken } from '../auth'
import { getCognitoToken } from '@/lib/cognito'

// API Gateway URL (デプロイ後に設定)
const API_BASE_URL = process.env.PERFUME_API_URL || ''

// IDからbrandとnameを分離 (フォーマット: brand#name)
const parseId = (id: string): { brand: string; name: string } | null => {
  const decoded = decodeURIComponent(id)
  const separatorIndex = decoded.indexOf('#')
  if (separatorIndex === -1) return null
  return {
    brand: decoded.slice(0, separatorIndex),
    name: decoded.slice(separatorIndex + 1),
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateAdminToken(req)) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  const { id } = req.query as { id: string }

  if (!id) {
    return res.status(400).json({ error: 'IDが必要です' })
  }

  const parsed = parseId(id)
  if (!parsed) {
    return res.status(400).json({ error: '無効なIDフォーマットです' })
  }

  // API Gateway URLが設定されていない場合はエラー
  if (!API_BASE_URL) {
    console.error('PERFUME_API_URL is not configured')
    return res.status(500).json({ error: 'API設定エラー' })
  }

  const { brand, name } = parsed
  const apiPath = `${API_BASE_URL}/perfumes/${encodeURIComponent(brand)}/${encodeURIComponent(name)}`

  try {
    // Cognito トークン取得
    const token = await getCognitoToken()

    if (req.method === 'GET') {
      const response = await fetch(apiPath, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Gateway error:', response.status, errorText)
        if (response.status === 404) {
          return res.status(404).json({ error: 'データが見つかりません' })
        }
        return res
          .status(response.status)
          .json({ error: 'データの取得に失敗しました' })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const response = await fetch(apiPath, {
        method: 'PUT',
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
          .json({ error: 'データの更新に失敗しました' })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    if (req.method === 'DELETE') {
      const response = await fetch(apiPath, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Gateway error:', response.status, errorText)
        return res
          .status(response.status)
          .json({ error: 'データの削除に失敗しました' })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({ error: '内部エラーが発生しました' })
  }
}
