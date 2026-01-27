import { getAgentCoreChatResponseStream } from './agentCoreChat'

export async function getAIChatResponseStream(
  userMessage: string
): Promise<ReadableStream<string> | null> {
  return getAgentCoreChatResponseStream(userMessage)
}
