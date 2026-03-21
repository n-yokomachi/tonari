import type { NextApiRequest, NextApiResponse } from 'next'
import {
  BedrockAgentCoreClient,
  CompleteResourceTokenAuthCommand,
} from '@aws-sdk/client-bedrock-agentcore'

const client = new BedrockAgentCoreClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
})

// Google OAuth callback: AgentCore Identity からリダイレクトされる
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionId = req.query.session_id as string | undefined
  if (!sessionId) {
    return res
      .status(400)
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          '<p>session_id が不足しています</p></body></html>'
      )
  }

  try {
    await client.send(
      new CompleteResourceTokenAuthCommand({
        sessionUri: sessionId,
        userIdentifier: { userId: 'tonari-owner' },
      })
    )

    return res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          '<p>Google連携が完了しました！このタブを閉じてOKです。</p></body></html>'
      )
  } catch (err) {
    console.error('CompleteResourceTokenAuth error:', err)
    return res
      .status(500)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        '<html><body style="text-align:center;padding:60px;font-family:sans-serif">' +
          `<p>Google連携エラー: ${err}</p></body></html>`
      )
  }
}
