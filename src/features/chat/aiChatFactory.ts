import {
  getAgentCoreChatResponseStream,
  type StreamChunk,
} from './agentCoreChat'

export type { StreamChunk }

export async function getAIChatResponseStream(
  userMessage: string,
  imageBase64?: string
): Promise<ReadableStream<StreamChunk> | null> {
  return getAgentCoreChatResponseStream(userMessage, imageBase64)
}
