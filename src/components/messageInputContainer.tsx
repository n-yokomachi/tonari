import { useState, useEffect } from 'react'
import { MessageInput } from '@/components/messageInput'
import homeStore from '@/features/stores/home'
import voiceInputStore from '@/features/stores/voiceInput'

type Props = {
  onChatProcessStart: (text: string) => void
}

export const MessageInputContainer = ({ onChatProcessStart }: Props) => {
  const [userMessage, setUserMessage] = useState('')
  const pendingInputText = voiceInputStore((s) => s.pendingInputText)

  // Write voice input text to the input form when available
  useEffect(() => {
    if (pendingInputText) {
      setUserMessage(pendingInputText)
      voiceInputStore.getState().setPendingInputText('')
    }
  }, [pendingInputText])

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
