import { NextApiRequest, NextApiResponse } from 'next'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
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

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': DEFAULT_USER_ID,
        },
        ScanIndexForward: false,
      })
    )

    const diaries = (result.Items || []).map((item) => ({
      date: item.date,
      body: item.body,
      createdAt: item.createdAt,
    }))

    return res.status(200).json({ diaries })
  } catch (err) {
    console.error('Failed to fetch diaries:', err)
    return res.status(500).json({ error: '日記の取得に失敗しました' })
  }
}
