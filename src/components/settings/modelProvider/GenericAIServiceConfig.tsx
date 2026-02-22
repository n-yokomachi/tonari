import { useCallback } from 'react'
import settingsStore from '@/features/stores/settings'
import { ApiKeyInput } from './ApiKeyInput'
import { ModelSelector } from './ModelSelector'
import { AIService } from '@/features/constants/settings'

interface GenericAIServiceConfigProps {
  service: AIService
  apiKey: string
  selectAIModel: string
  customModel: boolean
  config: {
    keyLabel?: string
    keyPlaceholder?: string
    linkUrl?: string
    linkLabel?: string
    description?: string
    customModelValidation?: boolean
  }
}

export const GenericAIServiceConfig = ({
  service,
  apiKey,
  selectAIModel,
  customModel,
  config,
}: GenericAIServiceConfigProps) => {
  const handleModelChange = useCallback((model: string) => {
    settingsStore.setState({ selectAIModel: model })
  }, [])

  const handleCustomModelToggle = useCallback(() => {
    settingsStore.setState({ customModel: !customModel })
  }, [customModel])

  const handleApiKeyChange = useCallback(
    (value: string) => {
      const keyMap: Record<string, string> = {
        anthropic: 'anthropicKey',
        google: 'googleKey',
        azure: 'azureKey',
        xai: 'xaiKey',
        groq: 'groqKey',
        cohere: 'cohereKey',
        mistralai: 'mistralaiKey',
        perplexity: 'perplexityKey',
        fireworks: 'fireworksKey',
        deepseek: 'deepseekKey',
        openrouter: 'openrouterKey',
      }

      const stateKey = keyMap[service]
      if (stateKey) {
        settingsStore.setState({ [stateKey]: value })
      }
    },
    [service]
  )

  return (
    <>
      {config.keyLabel && (
        <ApiKeyInput
          label={config.keyLabel}
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder={config.keyPlaceholder}
          linkUrl={config.linkUrl}
          linkLabel={config.linkLabel}
          description={config.description}
        />
      )}

      <ModelSelector
        aiService={service}
        selectedModel={selectAIModel}
        customModel={customModel}
        onModelChange={handleModelChange}
        onCustomModelToggle={handleCustomModelToggle}
        customModelValidation={config.customModelValidation}
      />
    </>
  )
}
