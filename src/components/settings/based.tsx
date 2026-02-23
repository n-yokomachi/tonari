import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import Image from 'next/image'
import { Language } from '@/features/constants/settings'
import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../textButton'
import { IMAGE_CONSTANTS } from '@/constants/images'

const Based = () => {
  const { t } = useTranslation()
  const selectLanguage = settingsStore((s) => s.selectLanguage)
  const showAssistantText = settingsStore((s) => s.showAssistantText)
  const showCharacterName = settingsStore((s) => s.showCharacterName)
  const showControlPanel = settingsStore((s) => s.showControlPanel)
  const voiceEnabled = settingsStore((s) => s.voiceEnabled)
  const voiceModel = settingsStore((s) => s.voiceModel)
  const useVideoAsBackground = settingsStore((s) => s.useVideoAsBackground)
  const changeEnglishToJapanese = settingsStore(
    (s) => s.changeEnglishToJapanese
  )
  const [backgroundFiles, setBackgroundFiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const backgroundImageUrl = homeStore((s) => s.backgroundImageUrl)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetch('/api/get-background-list')
      .then((res) => res.json())
      .then((files) =>
        setBackgroundFiles(files.filter((file: string) => file !== 'bg-c.png'))
      )
      .catch((error) => {
        console.error('Error fetching background list:', error)
        setError(t('BackgroundListFetchError'))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [t])

  const handleBackgroundUpload = async (file: File) => {
    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      setUploadError(t('OnlyImageFilesAllowed'))
      return
    }

    // ファイルサイズの検証（例：5MB以下）
    if (file.size > IMAGE_CONSTANTS.COMPRESSION.LARGE_FILE_THRESHOLD) {
      setUploadError(t('FileSizeLimitExceeded'))
      return
    }

    setIsUploading(true)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload-background', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`${t('UploadFailed')}: ${response.status}`)
      }

      const { path } = await response.json()
      homeStore.setState({ backgroundImageUrl: path })

      // バックグラウンドリストを更新
      setIsLoading(true)
      setError(null)
      const listResponse = await fetch('/api/get-background-list')
      if (!listResponse.ok) {
        throw new Error(t('BackgroundListFetchError'))
      }
      const files = await listResponse.json()
      setBackgroundFiles(files.filter((file: string) => file !== 'bg-c.png'))
    } catch (error) {
      console.error('Error uploading background:', error)
      setUploadError(t('BackgroundUploadError'))
    } finally {
      setIsUploading(false)
      setIsLoading(false)
    }
  }

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
        <div className="mb-4 text-xl font-bold">{t('Language')}</div>
        <div className="my-2">
          <select
            className="px-4 py-2 bg-white hover:bg-white-hover rounded-lg"
            value={selectLanguage}
            onChange={(e) => {
              const newLanguage = e.target.value as Language
              settingsStore.setState({ selectLanguage: newLanguage })
              i18n.changeLanguage(newLanguage)
            }}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      {selectLanguage === 'ja' && (
        <div className="my-6">
          <div className="my-4 font-bold">{t('EnglishToJapanese')}</div>
          <div className="my-2">
            <TextButton
              onClick={() =>
                settingsStore.setState((prevState) => ({
                  changeEnglishToJapanese: !prevState.changeEnglishToJapanese,
                }))
              }
            >
              {t(changeEnglishToJapanese ? 'StatusOn' : 'StatusOff')}
            </TextButton>
          </div>
        </div>
      )}
      <div className="mt-6">
        <div className="my-4 text-xl font-bold">{t('BackgroundSettings')}</div>
        <div className="my-4">{t('BackgroundSettingsDescription')}</div>

        {isLoading && <div className="my-2">{t('Loading')}</div>}
        {error && <div className="my-2 text-red-500">{error}</div>}
        {uploadError && <div className="my-2 text-red-500">{uploadError}</div>}

        <div className="flex flex-col mb-4">
          <select
            className="text-ellipsis px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
            value={backgroundImageUrl}
            onChange={(e) => {
              const path = e.target.value
              homeStore.setState({ backgroundImageUrl: path })
            }}
            disabled={isLoading || isUploading}
          >
            <option value="">{t('DefaultBackground')}</option>
            <option value="green">{t('GreenBackground')}</option>
            {backgroundFiles.map((file) => (
              <option key={file} value={`/backgrounds/${file}`}>
                {file}
              </option>
            ))}
          </select>
        </div>

        <div className="my-4">
          <TextButton
            onClick={() => {
              const { fileInput } = menuStore.getState()
              if (fileInput) {
                fileInput.accept = 'image/*'
                fileInput.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) {
                    handleBackgroundUpload(file)
                  }
                }
                fileInput.click()
              }
            }}
            disabled={isLoading || isUploading}
          >
            {isUploading ? t('Uploading') : t('UploadBackground')}
          </TextButton>
        </div>
      </div>

      {/* アシスタントテキスト表示設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('ShowAssistantText')}</div>
        <div className="my-2">
          <TextButton
            onClick={() =>
              settingsStore.setState((s) => ({
                showAssistantText: !s.showAssistantText,
              }))
            }
          >
            {showAssistantText ? t('StatusOn') : t('StatusOff')}
          </TextButton>
        </div>
      </div>

      {/* キャラクター名表示設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('ShowCharacterName')}</div>
        <div className="my-2">
          <TextButton
            onClick={() =>
              settingsStore.setState((s) => ({
                showCharacterName: !s.showCharacterName,
              }))
            }
          >
            {showCharacterName ? t('StatusOn') : t('StatusOff')}
          </TextButton>
        </div>
      </div>

      {/* コントロールパネル表示設定 */}
      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('ShowControlPanel')}</div>
        <div className="my-4 whitespace-pre-wrap">
          {t('ShowControlPanelInfo')}
        </div>

        <div className="my-2">
          <TextButton
            onClick={() =>
              settingsStore.setState({
                showControlPanel: !showControlPanel,
              })
            }
          >
            {showControlPanel ? t('StatusOn') : t('StatusOff')}
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
    </>
  )
}
export default Based
