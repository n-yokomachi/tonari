import { useState } from 'react'
import { MessageInput } from '@/components/messageInput'

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
    if (userMessage.trim()) {
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
