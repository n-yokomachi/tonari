import { getAIChatResponseStream } from '../../../features/chat/aiChatFactory'
import { getAgentCoreChatResponseStream } from '../../../features/chat/agentCoreChat'

jest.mock('../../../features/chat/agentCoreChat', () => ({
  getAgentCoreChatResponseStream: jest.fn(),
}))

describe('aiChatFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const testMessage = 'こんにちは'

  const createMockStream = () => {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('テスト応答')
        controller.close()
      },
    })
  }

  it('getAgentCoreChatResponseStreamを呼び出す', async () => {
    const mockStream = createMockStream()
    ;(getAgentCoreChatResponseStream as jest.Mock).mockResolvedValue(mockStream)

    const result = await getAIChatResponseStream(testMessage)

    expect(getAgentCoreChatResponseStream).toHaveBeenCalledWith(testMessage)
    expect(result).toBe(mockStream)
  })

  it('空のメッセージの場合、nullを返す', async () => {
    ;(getAgentCoreChatResponseStream as jest.Mock).mockResolvedValue(null)

    const result = await getAIChatResponseStream('')

    expect(getAgentCoreChatResponseStream).toHaveBeenCalledWith('')
    expect(result).toBeNull()
  })
})
