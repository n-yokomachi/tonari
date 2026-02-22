import { getAgentCoreChatResponseStream } from './agentCoreChat'

export async function getAIChatResponseStream(
  userMessage: string,
  imageBase64?: string
): Promise<ReadableStream<string> | null> {
  return getAgentCoreChatResponseStream(userMessage, imageBase64)
}
