import { useCallback } from 'react'
import homeStore from '@/features/stores/home'
import { handleSendChatFn } from '../features/chat/handlers'
import { MessageInputContainer } from './messageInputContainer'
import { PresetQuestionButtons } from './presetQuestionButtons'

export const Form = () => {
  const handleSendChat = handleSendChatFn()

  const hookSendChat = useCallback(
    (text: string) => {
      const modalImage = homeStore.getState().modalImage
      if (modalImage) {
        // modalImageが既に存在する場合はそのまま送信
        handleSendChat(text)
      } else {
        handleSendChat(text)
      }
    },
    [handleSendChat]
  )

  return (
    <div className="flex flex-col flex-shrink-0">
      <PresetQuestionButtons onSelectQuestion={hookSendChat} />
      <MessageInputContainer onChatProcessStart={hookSendChat} />
    </div>
  )
}
