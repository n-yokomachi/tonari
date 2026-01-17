import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { ModelSelector } from './modelProvider/ModelSelector'
import { useModelProviderState } from './modelProvider/hooks/useModelProviderState'
import { useAIServiceHandlers } from './modelProvider/hooks/useAIServiceHandlers'

const ModelProvider = () => {
  const { t } = useTranslation()
  const state = useModelProviderState()
  const { updateMultiModalModeForModel } = useAIServiceHandlers()

  const handleModelChange = useCallback(
    (model: string) => {
      settingsStore.setState({ selectAIModel: model })
      updateMultiModalModeForModel('anthropic', model)
    },
    [updateMultiModalModeForModel]
  )

  const handleCustomModelToggle = useCallback(() => {
    settingsStore.setState({ customModel: !state.customModel })
  }, [state.customModel])

  const handleMultiModalToggle = useCallback(() => {
    settingsStore.setState({ enableMultiModal: !state.enableMultiModal })
  }, [state.enableMultiModal])

  if (state.externalLinkageMode) return null

  return (
    <div className="mt-6">
      <ModelSelector
        aiService="anthropic"
        selectedModel={state.selectAIModel}
        customModel={state.customModel}
        enableMultiModal={state.enableMultiModal}
        onModelChange={handleModelChange}
        onCustomModelToggle={handleCustomModelToggle}
        onMultiModalToggle={handleMultiModalToggle}
        showMultiModalToggle={true}
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

      {state.isMultiModalSupported && (
        <>
          <div className="my-6">
            <div className="my-4 text-xl font-bold">{t('MultiModalMode')}</div>
            <div className="my-4 text-sm">{t('MultiModalModeDescription')}</div>
            <div className="my-2">
              <select
                className="px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
                value={state.multiModalMode}
                onChange={(e) =>
                  settingsStore.setState({
                    multiModalMode: e.target.value as
                      | 'ai-decide'
                      | 'always'
                      | 'never',
                  })
                }
              >
                <option value="ai-decide">{t('MultiModalModeAIDecide')}</option>
                <option value="always">{t('MultiModalModeAlways')}</option>
                <option value="never">{t('MultiModalModeNever')}</option>
              </select>
            </div>
            {state.multiModalMode === 'ai-decide' && (
              <div className="my-4">
                <div className="my-2 text-sm font-medium">
                  {t('MultiModalAIDecisionPrompt')}
                </div>
                <textarea
                  className="w-full px-4 py-2 bg-white hover:bg-white-hover rounded-lg text-sm"
                  rows={3}
                  value={state.multiModalAiDecisionPrompt}
                  onChange={(e) => {
                    settingsStore.setState({
                      multiModalAiDecisionPrompt: e.target.value,
                    })
                  }}
                  placeholder={t('MultiModalAIDecisionPromptPlaceholder')}
                />
              </div>
            )}
          </div>

          <div className="my-6">
            <div className="my-4 text-xl font-bold">
              {t('ImageDisplayPosition')}
            </div>
            <div className="my-4 text-sm">
              {t('ImageDisplayPositionDescription')}
            </div>
            <div className="my-2">
              <select
                className="px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
                value={state.imageDisplayPosition}
                onChange={(e) =>
                  settingsStore.setState({
                    imageDisplayPosition: e.target.value as
                      | 'input'
                      | 'side'
                      | 'icon',
                  })
                }
              >
                <option value="input">{t('InputArea')}</option>
                <option value="side">{t('SideArea')}</option>
                <option value="icon">{t('NoDisplay')}</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ModelProvider
