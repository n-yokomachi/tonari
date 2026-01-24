import { Message } from '@/features/messages/messages'
import { getAgentCoreChatResponseStream } from './agentCoreChat'

export async function getAIChatResponseStream(
  messages: Message[]
): Promise<ReadableStream<string> | null> {
  return getAgentCoreChatResponseStream(messages)
}
