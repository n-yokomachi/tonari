import { create } from 'zustand'

export type VoiceInputPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'awaitingFollowUp'
  | 'disabled'

interface VoiceInputState {
  phase: VoiceInputPhase
  interimTranscript: string
  finalTranscript: string
  pendingInputText: string
}

interface VoiceInputActions {
  setPhase: (phase: VoiceInputPhase) => void
  setInterimTranscript: (text: string) => void
  setFinalTranscript: (text: string) => void
  appendToFinalTranscript: (text: string) => void
  setPendingInputText: (text: string) => void
  reset: () => void
}

const initialState: VoiceInputState = {
  phase: 'disabled',
  interimTranscript: '',
  finalTranscript: '',
  pendingInputText: '',
}

const voiceInputStore = create<VoiceInputState & VoiceInputActions>()(
  (set) => ({
    ...initialState,
    setPhase: (phase) => set({ phase }),
    setInterimTranscript: (text) => set({ interimTranscript: text }),
    setFinalTranscript: (text) => set({ finalTranscript: text }),
    appendToFinalTranscript: (text) =>
      set((state) => ({ finalTranscript: state.finalTranscript + text })),
    setPendingInputText: (text) => set({ pendingInputText: text }),
    reset: () => set(initialState),
  })
)

export default voiceInputStore
