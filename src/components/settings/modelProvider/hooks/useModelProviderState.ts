import settingsStore from '@/features/stores/settings'

export const useModelProviderState = () => {
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)
  const selectAIModel = settingsStore((s) => s.selectAIModel)
  const maxPastMessages = settingsStore((s) => s.maxPastMessages)
  const temperature = settingsStore((s) => s.temperature)
  const maxTokens = settingsStore((s) => s.maxTokens)
  const customModel = settingsStore((s) => s.customModel)

  return {
    externalLinkageMode,
    selectAIModel,
    maxPastMessages,
    temperature,
    maxTokens,
    customModel,
  }
}
