import voiceInputStore from '@/features/stores/voiceInput'

export const VoiceInputIndicator = () => {
  const phase = voiceInputStore((s) => s.phase)
  const interimTranscript = voiceInputStore((s) => s.interimTranscript)
  const finalTranscript = voiceInputStore((s) => s.finalTranscript)

  if (phase === 'idle' || phase === 'disabled' || phase === 'processing')
    return null

  const displayText = finalTranscript + interimTranscript

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {/* Microphone icon with pulse */}
      <div className="relative flex items-center justify-center">
        {(phase === 'listening' || phase === 'awaitingFollowUp') && (
          <div className="absolute w-12 h-12 rounded-full bg-red-500/30 animate-ping" />
        )}
        <div
          className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
            phase === 'listening'
              ? 'bg-red-500'
              : phase === 'awaitingFollowUp'
                ? 'bg-amber-500'
                : 'bg-gray-500'
          }`}
        >
          <svg
            className="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </div>
      </div>

      {/* Status label */}
      {phase === 'awaitingFollowUp' && !displayText && (
        <div className="text-xs text-white/70 bg-black/50 rounded-full px-3 py-1">
          続けてどうぞ...
        </div>
      )}

      {/* Transcript preview */}
      {displayText && (
        <div className="max-w-sm bg-black/70 text-white text-sm rounded-lg px-4 py-2 backdrop-blur-sm">
          <span>{finalTranscript}</span>
          {interimTranscript && (
            <span className="text-white/60">{interimTranscript}</span>
          )}
        </div>
      )}
    </div>
  )
}
