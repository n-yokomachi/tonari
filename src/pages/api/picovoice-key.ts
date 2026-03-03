import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessKey = process.env.PICOVOICE_ACCESS_KEY || ''

  if (!accessKey) {
    return res
      .status(500)
      .json({ error: 'PICOVOICE_ACCESS_KEY is not configured' })
  }

  res.status(200).json({ accessKey })
}
