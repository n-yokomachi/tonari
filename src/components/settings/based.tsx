import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import type { ModelProvider } from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { TextButton } from '../textButton'

const MODEL_OPTIONS: {
  value: ModelProvider
  label: string
  description: string
}[] = [
  {
    value: 'bedrock',
    label: 'Claude Haiku 4.5',
    description: 'Amazon Bedrock',
  },
  {
    value: 'openrouter',
    label: 'Grok 4.1 Fast',
    description: 'OpenRouter',
  },
]

const Based = () => {
  const { t } = useTranslation()
  const colorTheme = settingsStore((s) => s.colorTheme)
  const uiStyle = settingsStore((s) => s.uiStyle)
  const modelProvider = settingsStore((s) => s.modelProvider)
  const reasoningEnabled = settingsStore((s) => s.reasoningEnabled)
  const voiceEnabled = settingsStore((s) => s.voiceEnabled)
  const voiceModel = settingsStore((s) => s.voiceModel)
  const wakeWordEnabled = settingsStore((s) => s.wakeWordEnabled)
  const isDark = colorTheme === 'tonari-dark'

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

      {/* LLMモデル選択 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">LLM Model</div>
        <div className="my-2 flex gap-2">
          {MODEL_OPTIONS.map((option) => (
            <TextButton
              key={option.value}
              onClick={() =>
                settingsStore.setState({ modelProvider: option.value })
              }
            >
              {option.label}
              {modelProvider === option.value ? ' ✓' : ''}
            </TextButton>
          ))}
        </div>
        <div className="mt-2 text-sm opacity-60">
          {MODEL_OPTIONS.find((o) => o.value === modelProvider)?.description}
        </div>
      </div>

      {/* Reasoning設定（OpenRouterのみ） */}
      {modelProvider === 'openrouter' && (
        <div className="my-6">
          <div className="my-4 text-xl font-bold">Reasoning</div>
          <div className="my-2 flex gap-2">
            <TextButton
              onClick={() =>
                settingsStore.setState({
                  reasoningEnabled: !reasoningEnabled,
                })
              }
            >
              {reasoningEnabled ? 'ON ✓' : 'OFF ✓'}
            </TextButton>
          </div>
          <div className="mt-2 text-sm opacity-60">
            {reasoningEnabled
              ? 'Reasoning ON: 推論精度が向上しますが、応答が遅くなります'
              : 'Reasoning OFF: 高速応答（推奨）'}
          </div>
        </div>
      )}

      {/* ダークモード設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">Dark Mode</div>
        <div className="my-2">
          <TextButton
            onClick={() =>
              settingsStore.setState({
                colorTheme: isDark ? 'tonari' : 'tonari-dark',
              })
            }
          >
            {isDark ? 'ON' : 'OFF'}
          </TextButton>
        </div>
      </div>

      {/* UIスタイル設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">UI Style</div>
        <div className="my-2">
          <select
            value={uiStyle}
            onChange={(e) =>
              settingsStore.setState({
                uiStyle: e.target.value as 'glass' | 'neumorphic' | 'droplet',
              })
            }
            className="px-4 py-2 rounded-lg bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-secondary transition-colors"
          >
            <option value="glass">Glass</option>
            <option value="neumorphic">Neumorphic</option>
            <option value="droplet">Droplet</option>
          </select>
        </div>
      </div>

      {/* キャラクター位置リセット */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">Character Position</div>
        <div className="my-2">
          <TextButton
            onClick={() => {
              homeStore.getState().viewer?.resetCameraPosition()
            }}
          >
            Reset Position
          </TextButton>
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
      {/* ウェイクワード検知設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">Wake Word Detection</div>
        <div className="my-4 whitespace-pre-wrap text-sm opacity-70">
          「TONaRi」と呼びかけると音声入力モードが起動します。
        </div>

        {/* ON/OFF トグル */}
        <div className="my-2">
          <TextButton
            onClick={() =>
              settingsStore.setState((s) => ({
                wakeWordEnabled: !s.wakeWordEnabled,
              }))
            }
          >
            {wakeWordEnabled ? 'ON' : 'OFF'}
          </TextButton>
        </div>
      </div>
    </>
  )
}
export default Based
