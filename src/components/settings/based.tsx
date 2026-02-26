import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../textButton'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

type PushStatus = 'loading' | 'subscribed' | 'unsubscribed' | 'unsupported'

const Based = () => {
  const { t } = useTranslation()
  const voiceEnabled = settingsStore((s) => s.voiceEnabled)
  const voiceModel = settingsStore((s) => s.voiceModel)

  const [pushStatus, setPushStatus] = useState<PushStatus>('loading')
  const [pushProcessing, setPushProcessing] = useState(false)
  const [pushError, setPushError] = useState('')

  const checkPushSubscription = useCallback(async () => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setPushStatus('unsupported')
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      setPushStatus('unsupported')
      return
    }
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setPushStatus(subscription ? 'subscribed' : 'unsubscribed')
    } catch {
      setPushStatus('unsubscribed')
    }
  }, [])

  useEffect(() => {
    checkPushSubscription()
  }, [checkPushSubscription])

  const handlePushToggle = async () => {
    setPushProcessing(true)
    setPushError('')

    try {
      if (pushStatus === 'subscribed') {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const endpoint = subscription.endpoint
          await subscription.unsubscribe()
          await fetch('/api/admin/push-subscription', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
          })
        }
        setPushStatus('unsubscribed')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setPushError(
            '通知の許可が拒否されました。ブラウザの設定から許可してください。'
          )
          setPushProcessing(false)
          return
        }
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
        const res = await fetch('/api/admin/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        })
        if (!res.ok) throw new Error('Failed to save subscription')
        setPushStatus('subscribed')
      }
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : '通知設定の変更に失敗しました'
      )
    } finally {
      setPushProcessing(false)
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

      {/* プッシュ通知設定 */}
      {pushStatus !== 'unsupported' && (
        <div className="my-6">
          <div className="my-4 text-xl font-bold">{t('PushNotification')}</div>
          <div className="my-4 whitespace-pre-wrap">
            {t('PushNotificationDescription')}
          </div>
          {pushError && (
            <div className="my-2 text-sm text-red-500">{pushError}</div>
          )}
          <div className="my-2">
            <TextButton onClick={handlePushToggle} disabled={pushProcessing}>
              {pushProcessing
                ? '処理中...'
                : pushStatus === 'subscribed'
                  ? t('StatusOn')
                  : t('StatusOff')}
            </TextButton>
          </div>
        </div>
      )}
    </>
  )
}
export default Based
