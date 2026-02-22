import { useState } from 'react'
import { MessageInput } from '@/components/messageInput'
import homeStore from '@/features/stores/home'

type Props = {
  onChatProcessStart: (text: string) => void
}

export const MessageInputContainer = ({ onChatProcessStart }: Props) => {
  const [userMessage, setUserMessage] = useState('')

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setUserMessage(event.target.value)
  }

  const handleSendMessage = () => {
    const hasImage = !!homeStore.getState().modalImage
    if (userMessage.trim() || hasImage) {
      onChatProcessStart(userMessage)
      setUserMessage('')
    }
  }

  return (
    <MessageInput
      userMessage={userMessage}
      onChangeUserMessage={handleInputChange}
      onClickSendButton={handleSendMessage}
    />
  )
}
