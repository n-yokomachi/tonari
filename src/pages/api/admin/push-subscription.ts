import { NextApiRequest, NextApiResponse } from 'next'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { validateAdminToken } from './auth'

const TABLE_NAME = 'tonari-push-subscriptions'
const REGION = process.env.AWS_REGION || 'ap-northeast-1'

const ddbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateAdminToken(req)) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  if (req.method === 'POST') {
    const { subscription } = req.body

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({ error: 'Invalid subscription data' })
    }

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            userId: 'tonari-owner',
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            createdAt: new Date().toISOString(),
          },
        })
      )
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Failed to save subscription:', error)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' })
    }

    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            userId: 'tonari-owner',
            endpoint,
          },
        })
      )
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Failed to delete subscription:', error)
      return res.status(500).json({ error: 'Failed to delete subscription' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
