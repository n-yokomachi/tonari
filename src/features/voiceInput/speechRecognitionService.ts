export interface SpeechRecognitionCallbacks {
  onInterimResult: (transcript: string) => void
  onFinalResult: (transcript: string) => void
  onEnd: () => void
  onError: (error: string) => void
}

export interface SpeechRecognitionService {
  readonly isSupported: boolean
  start(callbacks: SpeechRecognitionCallbacks): void
  stop(): void
  abort(): void
}

function getSpeechRecognitionConstructor(): {
  new (): SpeechRecognitionInstance
} | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as {
    new (): SpeechRecognitionInstance
  } | null
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionResultEvent {
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      [index: number]: { transcript: string }
    }
  }
}

export function createSpeechRecognitionService(): SpeechRecognitionService {
  const SpeechRecognitionCtor = getSpeechRecognitionConstructor()
  let recognition: SpeechRecognitionInstance | null = null

  return {
    get isSupported(): boolean {
      return getSpeechRecognitionConstructor() !== null
    },

    start(callbacks: SpeechRecognitionCallbacks): void {
      if (!SpeechRecognitionCtor) {
        callbacks.onError('SpeechRecognition is not supported in this browser')
        return
      }

      this.abort()

      recognition = new SpeechRecognitionCtor()
      recognition.lang = 'ja-JP'
      recognition.continuous = false
      recognition.interimResults = true

      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        let interim = ''
        let final = ''

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }

        if (interim) {
          callbacks.onInterimResult(interim)
        }
        if (final) {
          callbacks.onFinalResult(final)
        }
      }

      recognition.onend = () => {
        callbacks.onEnd()
      }

      recognition.onerror = (event: { error: string }) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return
        }
        callbacks.onError(event.error)
      }

      recognition.start()
    },

    stop(): void {
      if (recognition) {
        recognition.stop()
        recognition = null
      }
    },

    abort(): void {
      if (recognition) {
        recognition.abort()
        recognition = null
      }
    },
  }
}
