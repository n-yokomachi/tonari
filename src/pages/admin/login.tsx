import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'

const CREDENTIAL_STORAGE_KEY = 'tonari-admin-webauthn-credential'

type StoredCredential = {
  id: string
  publicKey: string
  counter: number
}

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTouchIdAvailable, setIsTouchIdAvailable] = useState(false)
  const [hasRegisteredCredential, setHasRegisteredCredential] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkTouchIdAvailability()
  }, [])

  const checkTouchIdAvailability = async () => {
    if (!browserSupportsWebAuthn()) {
      setShowPasswordForm(true)
      return
    }

    try {
      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      setIsTouchIdAvailable(available)

      if (available) {
        const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY)
        if (stored) {
          setHasRegisteredCredential(true)
        } else {
          setShowPasswordForm(true)
        }
      } else {
        setShowPasswordForm(true)
      }
    } catch {
      setShowPasswordForm(true)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        if (isTouchIdAvailable && !hasRegisteredCredential) {
          setShowRegisterPrompt(true)
          setShowPasswordForm(false)
        } else {
          window.location.href = '/admin/perfumes'
        }
      } else {
        setError('認証失敗')
      }
    } catch {
      setError('エラー')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterTouchId = async () => {
    setIsLoading(true)
    setError('')

    try {
      const optionsRes = await fetch('/api/admin/webauthn/register-options', {
        method: 'POST',
      })

      if (!optionsRes.ok) throw new Error('Failed')

      const options = await optionsRes.json()
      const regResponse = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/admin/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regResponse),
      })

      if (!verifyRes.ok) throw new Error('Failed')

      const verifyData = await verifyRes.json()

      if (verifyData.verified) {
        localStorage.setItem(
          CREDENTIAL_STORAGE_KEY,
          JSON.stringify(verifyData.credential)
        )
        window.location.href = '/admin/perfumes'
      }
    } catch {
      setError('登録失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTouchIdLogin = async () => {
    setIsLoading(true)
    setError('')

    try {
      const storedCredential = localStorage.getItem(CREDENTIAL_STORAGE_KEY)
      if (!storedCredential) {
        setError('未登録')
        return
      }

      const credential: StoredCredential = JSON.parse(storedCredential)

      const optionsRes = await fetch('/api/admin/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: credential.id }),
      })

      if (!optionsRes.ok) throw new Error('Failed')

      const options = await optionsRes.json()
      const authResponse = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/admin/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, credential }),
      })

      if (!verifyRes.ok) throw new Error('Failed')

      const verifyData = await verifyRes.json()

      if (verifyData.verified) {
        credential.counter = verifyData.newCounter
        localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credential))
        window.location.href = '/admin/perfumes'
      }
    } catch {
      setError('認証失敗')
    } finally {
      setIsLoading(false)
    }
  }

  // TouchID登録プロンプト
  if (showRegisterPrompt) {
    return (
      <>
        <Head>
          <title>Touch ID - TONaRi</title>
        </Head>
        <div className="min-h-screen bg-base-light flex flex-col items-center justify-center px-4">
          <button
            onClick={handleRegisterTouchId}
            disabled={isLoading}
            className="w-24 h-24 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 flex items-center justify-center group disabled:opacity-50"
          >
            <svg
              className="w-12 h-12 text-secondary group-hover:scale-110 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
              />
            </svg>
          </button>
          <p className="mt-6 text-gray-500 text-sm">
            {isLoading ? '...' : 'Touch ID'}
          </p>
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
          <button
            onClick={() => router.push('/admin/perfumes')}
            className="mt-8 text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            SKIP
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Admin - TONaRi</title>
      </Head>
      <div className="min-h-screen bg-base-light flex flex-col items-center justify-center px-4">
        {/* メインエリア */}
        <div className="flex flex-col items-center">
          {/* Touch IDボタン（登録済みの場合） */}
          {isTouchIdAvailable &&
            hasRegisteredCredential &&
            !showPasswordForm && (
              <>
                <button
                  onClick={handleTouchIdLogin}
                  disabled={isLoading}
                  className="w-24 h-24 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 flex items-center justify-center group disabled:opacity-50"
                >
                  <svg
                    className="w-12 h-12 text-secondary group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                    />
                  </svg>
                </button>
                {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
                {isLoading && <p className="mt-4 text-gray-500 text-sm">...</p>}
              </>
            )}

          {/* パスワードフォーム */}
          {showPasswordForm && (
            <form onSubmit={handlePasswordSubmit} className="w-64">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-secondary transition-colors text-center"
                required
                autoFocus
              />
              {error && (
                <p className="mt-2 text-red-500 text-sm text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 w-full py-3 bg-secondary hover:bg-secondary-hover rounded-lg text-white transition-colors disabled:opacity-50 tracking-wider"
              >
                {isLoading ? '...' : 'LOG IN'}
              </button>
            </form>
          )}
        </div>

        {/* 下部アイコンバー */}
        <div className="fixed bottom-8 flex items-center gap-6">
          {/* 戻るボタン */}
          <button
            onClick={() => router.push('/')}
            className="w-12 h-12 rounded-full bg-gray-200/50 hover:bg-gray-200 transition-colors flex items-center justify-center"
            title="トップに戻る"
          >
            <svg
              className="w-6 h-6 text-gray-500"
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

          {/* パスワード切り替えボタン（TouchID登録済みの場合のみ表示） */}
          {isTouchIdAvailable && hasRegisteredCredential && (
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="w-12 h-12 rounded-full bg-gray-200/50 hover:bg-gray-200 transition-colors flex items-center justify-center"
              title="パスワードでログイン"
            >
              <svg
                className="w-6 h-6 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
