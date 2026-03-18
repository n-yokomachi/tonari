/**
 * AivisSpeech Engine API client.
 * 2-step process: /audio_query → /synthesis
 * Returns WAV ArrayBuffer for playback.
 */
export async function fetchAivisSpeechAudio(
  text: string,
  speakerId: number,
  baseUrl: string
): Promise<ArrayBuffer> {
  // Step 1: Generate audio query
  const queryResponse = await fetch(
    `${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: 'POST' }
  )
  if (!queryResponse.ok) {
    throw new Error(`AivisSpeech audio_query failed: ${queryResponse.status}`)
  }
  const audioQuery = await queryResponse.json()

  // Step 2: Synthesize audio
  const synthesisResponse = await fetch(
    `${baseUrl}/synthesis?speaker=${speakerId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioQuery),
    }
  )
  if (!synthesisResponse.ok) {
    throw new Error(`AivisSpeech synthesis failed: ${synthesisResponse.status}`)
  }

  return synthesisResponse.arrayBuffer()
}
