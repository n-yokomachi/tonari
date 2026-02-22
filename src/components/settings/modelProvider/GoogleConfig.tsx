import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../../textButton'
import {
  getModels,
  googleSearchGroundingModels,
} from '@/features/constants/aiModels'

interface GoogleConfigProps {
  googleKey: string
  selectAIModel: string
  customModel: boolean
  useSearchGrounding: boolean
  dynamicRetrievalThreshold: number
}

export const GoogleConfig = ({
  googleKey,
  selectAIModel,
  customModel,
  useSearchGrounding,
  dynamicRetrievalThreshold,
}: GoogleConfigProps) => {
  const { t } = useTranslation()

  const handleModelChange = useCallback((model: string) => {
    settingsStore.setState({ selectAIModel: model })

    if (!googleSearchGroundingModels.includes(model as any)) {
      settingsStore.setState({ useSearchGrounding: false })
    }
  }, [])

  const handleCustomModelToggle = useCallback(() => {
    settingsStore.setState({ customModel: !customModel })
  }, [customModel])

  return (
    <>
      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('GoogleAPIKeyLabel')}</div>
        <div className="my-4">
          <a
            href="https://aistudio.google.com/app/apikey?hl=ja"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline"
          >
            Google AI Studio
          </a>
        </div>
        <input
          className="text-ellipsis px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
          type="password"
          placeholder="API Key"
          value={googleKey}
          onChange={(e) => {
            settingsStore.setState({ googleKey: e.target.value })
          }}
        />
      </div>

      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('SelectModel')}</div>
        <div className="my-4">
          <div className="mb-2">
            <TextButton onClick={handleCustomModelToggle}>
              {customModel ? t('CustomModelOn') : t('CustomModelOff')}
            </TextButton>
          </div>
          {customModel ? (
            <input
              className="text-ellipsis px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
              type="text"
              placeholder={t('CustomModelPlaceholder')}
              value={selectAIModel}
              onChange={(e) => handleModelChange(e.target.value.trim())}
              onBlur={(e) => {
                if (!e.target.value.trim()) {
                  const defaultModel = getModels('google')[0]
                  handleModelChange(defaultModel)
                  handleCustomModelToggle()
                }
              }}
            />
          ) : (
            <select
              className="px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
              value={selectAIModel}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {getModels('google').map((model) => {
                const isSearchEnabled = googleSearchGroundingModels.includes(
                  model as any
                )
                const icons = isSearchEnabled ? '🔍' : ''
                return (
                  <option key={model} value={model}>
                    {model} {icons}
                  </option>
                )
              })}
            </select>
          )}
        </div>
      </div>

      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('SearchGrounding')}</div>
        <div className="my-4">{t('SearchGroundingDescription')}</div>
        <div className="my-2">
          <TextButton
            onClick={() => {
              settingsStore.setState({
                useSearchGrounding: !useSearchGrounding,
              })
            }}
            disabled={
              !googleSearchGroundingModels.includes(selectAIModel as any)
            }
          >
            {useSearchGrounding ? t('StatusOn') : t('StatusOff')}
          </TextButton>
        </div>

        {useSearchGrounding &&
          googleSearchGroundingModels.includes(selectAIModel as any) && (
            <>
              <div className="mt-6 mb-4 text-xl font-bold">
                {t('DynamicRetrieval')}
              </div>
              <div className="my-4">{t('DynamicRetrievalDescription')}</div>
              <div className="my-4">
                <div className="mb-2 font-medium">
                  {t('DynamicRetrievalThreshold')}:{' '}
                  {dynamicRetrievalThreshold.toFixed(1)}
                </div>
                <div className="flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={dynamicRetrievalThreshold}
                    onChange={(e) => {
                      settingsStore.setState({
                        dynamicRetrievalThreshold: parseFloat(e.target.value),
                      })
                    }}
                    className="mt-2 mb-4 input-range"
                  />
                </div>
              </div>
            </>
          )}
      </div>
    </>
  )
}
