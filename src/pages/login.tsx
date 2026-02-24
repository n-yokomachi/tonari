import { useState, useEffect, FormEvent, useCallback } from 'react'
import Head from 'next/head'
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'

const CREDENTIAL_STORAGE_KEY = 'tonari-webauthn-credential'

type StoredCredential = {
  id: string
  publicKey: string
  counter: number
}

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTouchIdAvailable, setIsTouchIdAvailable] = useState(false)
  const [hasRegisteredCredential, setHasRegisteredCredential] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    checkTouchIdAvailability()
    // Trigger entrance animation
    requestAnimationFrame(() => setIsReady(true))
  }, [])

  // Clear shake animation after it plays
  useEffect(() => {
    if (hasError) {
      const timer = setTimeout(() => setHasError(false), 500)
      return () => clearTimeout(timer)
    }
  }, [hasError])

  const navigateWithTransition = useCallback((url: string) => {
    setIsExiting(true)
    setTimeout(() => {
      window.location.href = url
    }, 600)
  }, [])

  const triggerError = useCallback((message: string) => {
    setError(message)
    setHasError(true)
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
        // Re-check WebAuthn availability at submission time
        // (mount-time check may have failed due to timing or secure context)
        let canRegister = false
        try {
          if (browserSupportsWebAuthn()) {
            const available =
              await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            canRegister =
              available && !localStorage.getItem(CREDENTIAL_STORAGE_KEY)
          }
        } catch {
          // WebAuthn not available
        }

        if (canRegister) {
          setIsTouchIdAvailable(true)
          setShowRegisterPrompt(true)
          setShowPasswordForm(false)
        } else {
          navigateWithTransition('/')
        }
      } else {
        triggerError('Authentication failed')
      }
    } catch {
      triggerError('Error')
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
        navigateWithTransition('/')
      }
    } catch {
      triggerError('Registration failed')
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
        triggerError('Not registered')
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
        navigateWithTransition('/')
      }
    } catch {
      triggerError('Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Touch ID registration prompt
  if (showRegisterPrompt) {
    return (
      <>
        <Head>
          <title>Login - TONaRi</title>
        </Head>
        <style jsx global>
          {loginAnimationStyles}
        </style>
        <div
          className={`min-h-screen bg-base-light flex flex-col items-center justify-center px-4 transition-opacity duration-500 ${isExiting ? 'opacity-0 scale-105' : 'opacity-100'}`}
        >
          <div className="login-fade-in-up" style={{ animationDelay: '0ms' }}>
            <Branding />
          </div>
          <div
            className="mt-12 login-fade-in-up"
            style={{ animationDelay: '200ms' }}
          >
            <button
              onClick={handleRegisterTouchId}
              disabled={isLoading}
              className="w-28 h-28 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 flex items-center justify-center group login-ripple"
            >
              <svg
                className="w-14 h-14 text-secondary group-hover:scale-110 transition-transform"
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
          </div>
          {error && (
            <p
              className={`mt-3 text-red-400 text-sm ${hasError ? 'login-shake' : ''}`}
            >
              {error}
            </p>
          )}
          <button
            onClick={() => navigateWithTransition('/')}
            className="mt-10 text-gray-400 hover:text-gray-500 text-xs tracking-widest transition-colors login-fade-in-up"
            style={{ animationDelay: '400ms' }}
          >
            SKIP
          </button>
          <div className="fixed bottom-8 left-0 right-0 flex justify-center">
            <a
              href="https://github.com/n-yokomachi/tonari"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Login - TONaRi</title>
      </Head>
      <style jsx global>
        {loginAnimationStyles}
      </style>
      <div
        className={`min-h-screen bg-base-light flex flex-col items-center justify-center px-4 transition-all duration-500 ease-out ${isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
      >
        <div
          className={`transition-all duration-700 ease-out ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <Branding />
        </div>

        {/* Auth UI */}
        <div
          className={`mt-12 flex flex-col items-center transition-all duration-700 ease-out delay-200 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Touch ID button (if registered) */}
          {isTouchIdAvailable &&
            hasRegisteredCredential &&
            !showPasswordForm && (
              <>
                <button
                  onClick={handleTouchIdLogin}
                  disabled={isLoading}
                  className={`w-28 h-28 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 flex items-center justify-center group ${isLoading ? 'login-ripple-active' : 'login-ripple'}`}
                >
                  <svg
                    className="w-14 h-14 text-secondary group-hover:scale-110 transition-transform"
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
                {error && (
                  <p
                    className={`mt-4 text-red-400 text-sm ${hasError ? 'login-shake' : ''}`}
                  >
                    {error}
                  </p>
                )}
              </>
            )}

          {/* Password form */}
          {showPasswordForm && (
            <form
              onSubmit={handlePasswordSubmit}
              className={`w-64 relative ${hasError ? 'login-shake' : ''}`}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-white/60 backdrop-blur border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-secondary transition-colors text-center tracking-widest"
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-secondary hover:bg-secondary-hover active:scale-95 rounded-md text-white transition-all duration-150 disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? (
                  <span className="text-xs">...</span>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                )}
              </button>
            </form>
          )}
          {error && showPasswordForm && (
            <p className="mt-2 text-red-400 text-sm text-center login-fade-in-up">
              {error}
            </p>
          )}
        </div>

        {/* Bottom icons */}
        <div
          className={`fixed bottom-8 left-0 right-0 flex justify-center gap-6 transition-all duration-700 ease-out delay-700 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {isTouchIdAvailable && hasRegisteredCredential && (
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="w-10 h-10 rounded-full bg-gray-300 hover:bg-gray-500 transition-colors flex items-center justify-center"
              title="Password login"
            >
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </button>
          )}
          <a
            href="https://github.com/n-yokomachi/tonari"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </>
  )
}

function Branding() {
  return (
    <div className="text-center">
      <h1 className="text-5xl font-light tracking-[0.3em] text-secondary font-Montserrat">
        TONaRi
      </h1>
      <p className="mt-3 text-[11px] text-gray-400 tracking-[0.25em] font-light">
        An AI Agent Standing With{' '}
        <a
          href="https://x.com/_cityside"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary/60 hover:text-secondary transition-colors"
        >
          @_cityside
        </a>
      </p>
    </div>
  )
}

const loginAnimationStyles = `
  @keyframes loginFadeInUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes loginRipple {
    0% {
      transform: translate(-50%, -50%) scale(0.3);
      opacity: 0.6;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }

  @keyframes loginShake {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-6px); }
    30% { transform: translateX(5px); }
    45% { transform: translateX(-4px); }
    60% { transform: translateX(3px); }
    75% { transform: translateX(-2px); }
    90% { transform: translateX(1px); }
  }

  .login-fade-in-up {
    animation: loginFadeInUp 0.7s ease-out both;
  }

  .login-ripple {
    position: relative;
    overflow: visible;
  }

  .login-ripple::before,
  .login-ripple::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 150%;
    height: 150%;
    border-radius: 50%;
    border: 2px solid rgba(92, 75, 125, 0.45);
    opacity: 0;
    animation: loginRipple 3s ease-out infinite;
    pointer-events: none;
  }

  .login-ripple::after {
    animation-delay: 1.5s;
  }

  .login-ripple > svg {
    filter: drop-shadow(0 0 5px rgba(92, 75, 125, 0.25));
  }

  .login-ripple-active {
    position: relative;
    overflow: visible;
  }

  .login-ripple-active::before,
  .login-ripple-active::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 150%;
    height: 150%;
    border-radius: 50%;
    border: 2.5px solid rgba(59, 130, 246, 0.5);
    opacity: 0;
    animation: loginRipple 1.5s ease-out infinite;
    pointer-events: none;
  }

  .login-ripple-active::after {
    animation-delay: 0.75s;
  }

  .login-ripple-active > svg {
    filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.4));
  }

  .login-shake {
    animation: loginShake 0.4s ease-out;
  }
`
