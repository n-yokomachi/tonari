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
    if (userMessage.trim()) {
      onChatProcessStart(userMessage)
      setUserMessage('')
    }
  }

  const handleStopSpeaking = () => {
    homeStore.setState({ isSpeaking: false })
  }

  return (
    <MessageInput
      userMessage={userMessage}
      onChangeUserMessage={handleInputChange}
      onClickSendButton={handleSendMessage}
      onClickStopButton={handleStopSpeaking}
    />
  )
}
