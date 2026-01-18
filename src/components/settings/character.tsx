import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'

const Character = () => {
  const { t } = useTranslation()
  const { fixedCharacterPosition, lightingIntensity } = settingsStore()

  const handlePositionAction = (action: 'fix' | 'unfix' | 'reset') => {
    try {
      const { viewer } = homeStore.getState()

      const methodMap = {
        fix: 'fixCameraPosition',
        unfix: 'unfixCameraPosition',
        reset: 'resetCameraPosition',
      }
      const method = methodMap[action]
      if (viewer && typeof (viewer as any)[method] === 'function') {
        ;(viewer as any)[method]()
      } else {
        throw new Error(`VRM viewer method ${method} not available`)
      }

      const messageMap = {
        fix: t('Toasts.PositionFixed'),
        unfix: t('Toasts.PositionUnfixed'),
        reset: t('Toasts.PositionReset'),
      }

      toastStore.getState().addToast({
        message: messageMap[action],
        type: action === 'fix' ? 'success' : 'info',
        tag: `position-${action}`,
      })
    } catch (error) {
      console.error(`Position ${action} failed:`, error)
      toastStore.getState().addToast({
        message: t('Toasts.PositionActionFailed'),
        type: 'error',
        tag: 'position-error',
      })
    }
  }

  return (
    <>
      <div className="flex items-center mb-6">
        <Image
          src="/images/setting-icons/character-settings.svg"
          alt="Character Settings"
          width={24}
          height={24}
          className="mr-2"
        />
        <h2 className="text-2xl font-bold">{t('CharacterSettings')}</h2>
      </div>
      <div className="">
        {/* Character Position Controls */}
        <div className="my-6">
          <div className="text-xl font-bold mb-4">{t('CharacterPosition')}</div>
          <div className="mb-4">{t('CharacterPositionInfo')}</div>
          <div className="mb-2 text-sm font-medium">
            {t('CurrentStatus')}:{' '}
            <span className="font-bold">
              {fixedCharacterPosition
                ? t('PositionFixed')
                : t('PositionNotFixed')}
            </span>
          </div>
          <div className="flex gap-4 md:flex-row flex-col">
            <button
              onClick={() => handlePositionAction('fix')}
              className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
            >
              {t('FixPosition')}
            </button>
            <button
              onClick={() => handlePositionAction('unfix')}
              className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
            >
              {t('UnfixPosition')}
            </button>
            <button
              onClick={() => handlePositionAction('reset')}
              className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
            >
              {t('ResetPosition')}
            </button>
          </div>
        </div>

        {/* VRM Lighting Controls */}
        <div className="my-6">
          <div className="text-xl font-bold mb-4">照明の強度</div>
          <div className="mb-4">
            VRMキャラクターの照明の明るさを調整します。
          </div>
          <div className="font-bold">
            照明の強度: {lightingIntensity.toFixed(1)}
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={lightingIntensity}
            onChange={(e) => {
              const intensity = parseFloat(e.target.value)
              settingsStore.setState({ lightingIntensity: intensity })
              const { viewer } = homeStore.getState()
              if (
                viewer &&
                typeof viewer.updateLightingIntensity === 'function'
              ) {
                viewer.updateLightingIntensity(intensity)
              }
            }}
            className="mt-2 mb-4 input-range"
          />
        </div>
      </div>
    </>
  )
}
export default Character
