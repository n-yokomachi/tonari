import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

type SubscriptionStatus =
  | 'loading'
  | 'subscribed'
  | 'unsubscribed'
  | 'unsupported'

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

export default function AdminNotifications() {
  const [status, setStatus] = useState<SubscriptionStatus>('loading')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const checkSubscription = useCallback(async () => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported')
      return
    }

    if (!VAPID_PUBLIC_KEY) {
      setStatus('unsupported')
      setError('VAPID公開鍵が設定されていません')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setStatus(subscription ? 'subscribed' : 'unsubscribed')
    } catch {
      setStatus('unsubscribed')
    }
  }, [])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  const handleSubscribe = async () => {
    setIsProcessing(true)
    setError('')

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError(
          '通知の許可が拒否されました。ブラウザの設定から許可してください。'
        )
        setIsProcessing(false)
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

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (!res.ok) throw new Error('Failed to save subscription')

      setStatus('subscribed')
    } catch (err) {
      setError(err instanceof Error ? err.message : '購読登録に失敗しました')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUnsubscribe = async () => {
    setIsProcessing(true)
    setError('')

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()

        const res = await fetch('/api/admin/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })

        if (res.status === 401) {
          router.push('/login')
          return
        }
      }

      setStatus('unsubscribed')
    } catch (err) {
      setError(err instanceof Error ? err.message : '購読解除に失敗しました')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Head>
        <title>通知設定 - TONaRi</title>
      </Head>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="text-sm font-medium text-gray-600 tracking-wider">
                通知設定
              </span>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="戻る"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Web Push通知
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              TONaRiからのニュース通知をブラウザで受信できます。
              ブラウザを開いていれば、サイトを表示していなくても通知を受け取れます。
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {status === 'loading' && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-secondary rounded-full animate-spin" />
                <span className="text-sm">状態を確認中...</span>
              </div>
            )}

            {status === 'unsupported' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  このブラウザはWeb Push通知に対応していません。
                </p>
              </div>
            )}

            {status === 'subscribed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-green-700">
                    通知 ON
                  </span>
                </div>
                <button
                  onClick={handleUnsubscribe}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isProcessing ? '処理中...' : '通知をオフにする'}
                </button>
              </div>
            )}

            {status === 'unsubscribed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full" />
                  <span className="text-sm font-medium text-gray-500">
                    通知 OFF
                  </span>
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm bg-secondary hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isProcessing ? '処理中...' : '通知をオンにする'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
