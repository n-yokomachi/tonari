import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { ApiKeyInput } from './ApiKeyInput'

interface OpenRouterConfigProps {
  openrouterKey: string
  selectAIModel: string
}

export const OpenRouterConfig = ({
  openrouterKey,
  selectAIModel,
}: OpenRouterConfigProps) => {
  const { t } = useTranslation()

  return (
    <>
      <ApiKeyInput
        label={t('OpenRouterAPIKeyLabel')}
        value={openrouterKey}
        onChange={(value) => settingsStore.setState({ openrouterKey: value })}
        linkUrl="https://openrouter.ai/keys"
        linkLabel={t('OpenRouterDashboardLink', 'OpenRouter Dashboard')}
      />

      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('SelectModel')}</div>
        <input
          className="text-ellipsis px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
          type="text"
          value={selectAIModel}
          onChange={(e) =>
            settingsStore.setState({ selectAIModel: e.target.value })
          }
        />
      </div>
    </>
  )
}
