import { NextApiRequest, NextApiResponse } from 'next'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { validateAdminToken } from '../auth'

const TABLE_NAME = process.env.DIARY_TABLE_NAME || 'tonari-diary'
const DEFAULT_USER_ID = 'default_user'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))

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

  const { date } = req.query
  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: '日付パラメータが必要です' })
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: DEFAULT_USER_ID,
          date: date,
        },
      })
    )

    if (!result.Item) {
      return res.status(404).json({ error: '日記が見つかりません' })
    }

    return res.status(200).json({
      diary: {
        date: result.Item.date,
        body: result.Item.body,
        createdAt: result.Item.createdAt,
      },
    })
  } catch (err) {
    console.error('Failed to fetch diary:', err)
    return res.status(500).json({ error: '日記の取得に失敗しました' })
  }
}
