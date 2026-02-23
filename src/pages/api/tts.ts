import type { NextApiRequest, NextApiResponse } from 'next'
import { getCognitoToken } from '@/lib/cognito'

const API_BASE_URL = process.env.PERFUME_API_URL || ''

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, emotion, voice } = req.body || {}

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' })
  }

  if (!API_BASE_URL) {
    console.error('PERFUME_API_URL is not configured')
    return res.status(500).json({ error: 'TTS service not configured' })
  }

  try {
    const token = await getCognitoToken()

    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text,
        emotion: emotion || 'neutral',
        voice: voice || 'Tomoko',
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('TTS API error:', response.status, errorBody)
      return res.status(response.status).json({ error: 'TTS synthesis failed' })
    }

    const data = await response.json()
    const audioBuffer = Buffer.from(data.audio, 'base64')

    res.setHeader('Content-Type', 'audio/pcm')
    res.setHeader('Content-Length', audioBuffer.length)
    return res.status(200).send(audioBuffer)
  } catch (error) {
    console.error('TTS route error:', error)
    return res.status(500).json({ error: 'TTS service unavailable' })
  }
}
