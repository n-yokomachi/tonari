/**
 * agentCoreChat.ts のテスト
 * actorIdが固定値 'tonari-owner' として送信されることを検証
 */
import { getAgentCoreChatResponseStream } from '../../../features/chat/agentCoreChat'

// fetchをモック
const mockFetch = jest.fn()
global.fetch = mockFetch

// crypto.randomUUIDをモック（sessionId生成用）
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
  },
})

// TextDecoderをモック
global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockReturnValue(''),
})) as unknown as typeof TextDecoder

const createMockResponse = () => ({
  ok: true,
  body: {
    getReader: () => ({
      read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    }),
  },
})

describe('agentCoreChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Storage.prototype.getItem = jest.fn()
    Storage.prototype.setItem = jest.fn()
  })

  describe('getAgentCoreChatResponseStream', () => {
    it('actorIdとして固定値 "tonari-owner" を送信する', async () => {
      mockFetch.mockResolvedValue(createMockResponse())

      await getAgentCoreChatResponseStream('テスト')

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.actorId).toBe('tonari-owner')
    })

    it('actorIdにlocalStorageの値を使用しない', async () => {
      mockFetch.mockResolvedValue(createMockResponse())

      await getAgentCoreChatResponseStream('テスト')

      const getItemCalls = (Storage.prototype.getItem as jest.Mock).mock.calls
      const actorIdCalls = getItemCalls.filter(
        (call: string[]) => call[0] === 'tonari_actor_id'
      )
      expect(actorIdCalls).toHaveLength(0)
    })

    it('sessionIdはlocalStorageで管理される（変更なし）', async () => {
      ;(Storage.prototype.getItem as jest.Mock).mockImplementation(
        (key: string) => {
          if (key === 'tonari_session_id') return 'session-existing'
          return null
        }
      )
      mockFetch.mockResolvedValue(createMockResponse())

      await getAgentCoreChatResponseStream('テスト')

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.sessionId).toBe('session-existing')
    })
  })
})
