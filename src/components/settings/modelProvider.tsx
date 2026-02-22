import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { ModelSelector } from './modelProvider/ModelSelector'
import { useModelProviderState } from './modelProvider/hooks/useModelProviderState'

const ModelProvider = () => {
  const { t } = useTranslation()
  const state = useModelProviderState()

  const handleModelChange = useCallback((model: string) => {
    settingsStore.setState({ selectAIModel: model })
  }, [])

  const handleCustomModelToggle = useCallback(() => {
    settingsStore.setState({ customModel: !state.customModel })
  }, [state.customModel])

  if (state.externalLinkageMode) return null

  return (
    <div className="mt-6">
      <ModelSelector
        aiService="anthropic"
        selectedModel={state.selectAIModel}
        customModel={state.customModel}
        onModelChange={handleModelChange}
        onCustomModelToggle={handleCustomModelToggle}
      />

      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('MaxPastMessages')}</div>
        <div className="my-2">
          <input
            type="number"
            min="1"
            max="9999"
            className="px-4 py-2 w-24 bg-white hover:bg-white-hover rounded-lg"
            value={state.maxPastMessages}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              if (!Number.isNaN(value) && value >= 1 && value <= 9999) {
                settingsStore.setState({ maxPastMessages: value })
              }
            }}
          />
        </div>
      </div>

      <div className="my-6">
        <div className="my-4 text-xl font-bold">
          {t('Temperature')}: {state.temperature.toFixed(2)}
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={state.temperature}
          className="mt-2 mb-4 input-range"
          onChange={(e) =>
            settingsStore.setState({
              temperature: parseFloat(e.target.value),
            })
          }
        />
      </div>

      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('MaxTokens')}</div>
        <div className="my-2 text-sm ">{t('MaxTokensInfo')}</div>
        <div className="my-2">
          <input
            type="number"
            min="1"
            className="px-4 py-2 w-140 bg-white hover:bg-white-hover rounded-lg"
            value={state.maxTokens}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              if (!Number.isNaN(value) && value >= 1) {
                settingsStore.setState({ maxTokens: value })
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default ModelProvider
