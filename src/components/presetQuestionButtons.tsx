import { useCallback, useRef, useEffect, useState } from 'react'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { SpeakQueue } from '@/features/messages/speakQueue'
import { PRESET_QUESTIONS } from '@/features/constants/presetQuestions'

type Props = {
  onSelectQuestion: (text: string) => void
}

export const PresetQuestionButtons = ({ onSelectQuestion }: Props) => {
  const showPresetQuestions = settingsStore((s) => s.showPresetQuestions)
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const [shouldCenter, setShouldCenter] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isProcessing = chatProcessing

  const handleQuestionClick = useCallback(
    (text: string) => {
      if (isProcessing) return
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      onSelectQuestion(text)
    },
    [onSelectQuestion, isProcessing]
  )

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const contentWidth = contentRef.current.scrollWidth
        setShouldCenter(contentWidth <= containerWidth)
      }
    }

    checkOverflow()

    const handleResize = () => {
      checkOverflow()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  if (!showPresetQuestions || PRESET_QUESTIONS.length === 0) {
    return null
  }

  return (
    <div className="w-full flex-shrink-0 pt-4">
      <div className="mx-auto max-w-4xl px-4" ref={containerRef}>
        <div
          ref={contentRef}
          className={`flex overflow-x-auto pb-4 gap-3 preset-questions-scroll ${
            shouldCenter ? 'justify-center' : 'justify-start'
          }`}
        >
          {PRESET_QUESTIONS.map((question) => (
            <button
              key={question.id}
              onClick={() => handleQuestionClick(question.text)}
              disabled={isProcessing}
              className="rounded-2xl px-4 py-2.5 whitespace-nowrap transition-all duration-200 border border-white/40 dark:border-white/10 text-gray-700 dark:text-gray-300 bg-white/25 dark:bg-[rgba(20,20,35,0.45)] hover:bg-white/40 dark:hover:bg-white/15 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{
                backdropFilter: 'blur(16px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
              }}
            >
              {question.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
