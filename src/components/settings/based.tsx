import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../textButton'

const Based = () => {
  const { t } = useTranslation()
  const voiceEnabled = settingsStore((s) => s.voiceEnabled)
  const voiceModel = settingsStore((s) => s.voiceModel)

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center mb-6">
          <div
            className="w-6 h-6 mr-2 icon-mask-default"
            style={{
              maskImage: 'url(/images/setting-icons/basic-settings.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
            }}
          />
          <h2 className="text-2xl font-bold">{t('BasedSettings')}</h2>
        </div>
      </div>

      {/* 音声出力設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('VoiceOutput')}</div>
        <div className="my-4 whitespace-pre-wrap">
          {t('VoiceOutputDescription')}
        </div>
        <div className="my-2">
          <TextButton
            onClick={() =>
              settingsStore.setState((s) => ({
                voiceEnabled: !s.voiceEnabled,
              }))
            }
          >
            {voiceEnabled ? t('StatusOn') : t('StatusOff')}
          </TextButton>
        </div>
        {voiceEnabled && (
          <div className="my-4">
            <div className="my-2 font-bold">{t('VoiceModel')}</div>
            <div className="my-2 flex gap-2">
              <TextButton
                onClick={() => settingsStore.setState({ voiceModel: 'Tomoko' })}
              >
                Tomoko{voiceModel === 'Tomoko' ? ' ✓' : ''}
              </TextButton>
              <TextButton
                onClick={() => settingsStore.setState({ voiceModel: 'Kazuha' })}
              >
                Kazuha{voiceModel === 'Kazuha' ? ' ✓' : ''}
              </TextButton>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
export default Based
