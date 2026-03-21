import { ContentBlock, Message } from './messages'
import settingsStore from '@/features/stores/settings'

/** ContentBlock 配列からテキストを抽出 */
function getTextFromBlocks(blocks: ContentBlock[]): string {
  const textBlock = blocks.find(
    (b): b is ContentBlock & { type: 'text' } => b.type === 'text'
  )
  return textBlock?.text || ''
}

/** ContentBlock 配列から画像URLを抽出 */
function getImageFromBlocks(blocks: ContentBlock[]): string {
  const imgBlock = blocks.find(
    (b): b is ContentBlock & { type: 'image' } => b.type === 'image'
  )
  return imgBlock?.image || ''
}

export const messageSelectors = {
  // テキストまたは画像を含むメッセージのみを取得（tool-statusは除外）
  getTextAndImageMessages: (messages: Message[]): Message[] => {
    return messages.filter((message): boolean => {
      if (!message.content) return false
      if (message.role === 'tool-status') return false
      return (
        typeof message.content === 'string' || Array.isArray(message.content)
      )
    })
  },

  // 音声メッセージのみを取得
  getAudioMessages: (messages: Message[]): Message[] => {
    return messages.filter((message) => {
      if (message.role === 'system') {
        return message.content
      }
      // userの場合：contentがstring型のメッセージのみを許可
      if (message.role === 'user') {
        return typeof message.content === 'string'
      }
      // assistantの場合：audioプロパティを持つメッセージのみを許可
      if (message.role === 'assistant') {
        return message.audio !== undefined
      }
      // その他のroleは除外
      return false
    })
  },

  // メッセージを処理して、テキストメッセージのみを取得
  getProcessedMessages: (
    messages: Message[],
    includeTimestamp: boolean
  ): Message[] => {
    const maxPastMessages = settingsStore.getState().maxPastMessages
    return messages
      .map((message, index) => {
        // 最後のメッセージだけそのまま利用する（= 最後のメッセージだけマルチモーダルの対象となる）
        const isLastMessage = index === messages.length - 1
        const messageText = Array.isArray(message.content)
          ? getTextFromBlocks(message.content)
          : message.content || ''

        let content: Message['content']
        if (includeTimestamp) {
          const textWithTimestamp = message.timestamp
            ? `[${message.timestamp}] ${messageText}`
            : messageText
          if (isLastMessage && Array.isArray(message.content)) {
            const imageUrl = getImageFromBlocks(message.content)
            const blocks: ContentBlock[] = [
              { type: 'text', text: textWithTimestamp },
            ]
            if (imageUrl) {
              blocks.push({ type: 'image', image: imageUrl })
            }
            content = blocks
          } else {
            content = textWithTimestamp
          }
        } else {
          content = isLastMessage ? message.content : messageText
        }

        return {
          role: ['assistant', 'user', 'system'].includes(message.role)
            ? message.role
            : 'assistant',
          content,
        }
      })
      .slice(-maxPastMessages)
  },

  // メッセージを正規化して、連続する同一メッセージを統合
  normalizeMessages: (messages: Message[]): Message[] => {
    let lastImageUrl = ''
    return messages
      .reduce((acc: Message[], item: Message) => {
        if (item.content && Array.isArray(item.content)) {
          const imgUrl = getImageFromBlocks(item.content)
          if (imgUrl) lastImageUrl = imgUrl
        }

        const lastItem = acc[acc.length - 1]
        if (
          lastItem &&
          lastItem.role === item.role &&
          lastItem.id !== undefined &&
          item.id !== undefined &&
          lastItem.id === item.id
        ) {
          const itemText = Array.isArray(item.content)
            ? getTextFromBlocks(item.content)
            : typeof item.content === 'string'
              ? item.content
              : ''
          if (itemText) {
            const currentText =
              typeof lastItem.content === 'string'
                ? lastItem.content
                : Array.isArray(lastItem.content)
                  ? getTextFromBlocks(lastItem.content)
                  : ''
            if (Array.isArray(lastItem.content)) {
              const textBlock = lastItem.content.find((b) => b.type === 'text')
              if (textBlock && textBlock.type === 'text') {
                textBlock.text = currentText + ' ' + itemText
              }
            } else {
              lastItem.content = currentText + ' ' + itemText
            }
          }
        } else {
          const text = item.content
            ? Array.isArray(item.content)
              ? getTextFromBlocks(item.content)
              : item.content
            : ''
          if (lastImageUrl != '') {
            acc.push({
              ...item,
              content: [
                { type: 'text', text: text.trim() },
                { type: 'image', image: lastImageUrl },
              ],
            })
            lastImageUrl = ''
          } else {
            acc.push({ ...item, content: text.trim() })
          }
        }
        return acc
      }, [])
      .filter((item) => item.content !== '')
  },

  // 画像メッセージをテキストメッセージに変換
  cutImageMessage: (messages: Message[]): Message[] => {
    return messages.map((message: Message) => ({
      ...message,
      content:
        message.content === undefined
          ? ''
          : typeof message.content === 'string'
            ? message.content
            : getTextFromBlocks(message.content),
    }))
  },

  // APIで保存する際のメッセージ処理
  sanitizeMessageForStorage: (message: Message): any => {
    if (message.audio !== undefined) {
      return {
        ...message,
        audio: '[audio data omitted]',
      }
    }

    if (message.content && Array.isArray(message.content)) {
      return {
        ...message,
        content: message.content.map((block) => {
          if (block.type === 'image') {
            return {
              type: 'image',
              image: '[image data omitted]',
            }
          }
          return block
        }),
      }
    }
    return message
  },
}
