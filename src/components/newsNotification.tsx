import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import Image from 'next/image'
import { Cormorant_Garamond } from 'next/font/google'
import homeStore from '@/features/stores/home'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
})

type NewsData = {
  summary: string
  updatedAt: string
}

const NEWS_SCHEDULE_HOURS = [9, 21]
const SCHEDULE_DELAY_MS = 5 * 60 * 1000
const RETRY_INTERVAL_MS = 5 * 60 * 1000
const MAX_RETRIES = 3

function getNextScheduleTime(): Date {
  const now = new Date()
  const jstOffset = 9 * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const jstMinutes = utcMinutes + jstOffset

  const jstHour = Math.floor((jstMinutes % (24 * 60)) / 60)

  for (const hour of NEWS_SCHEDULE_HOURS) {
    if (jstHour < hour) {
      const diff = (hour - jstHour) * 60 - (jstMinutes % 60)
      return new Date(now.getTime() + diff * 60 * 1000)
    }
  }

  const nextDay0 = (24 - jstHour) * 60 - (jstMinutes % 60)
  return new Date(
    now.getTime() + (nextDay0 + NEWS_SCHEDULE_HOURS[0] * 60) * 60 * 1000
  )
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function linkifyText(text: string): ReactNode[] {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all"
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

export const NewsNotification = () => {
  const [news, setNews] = useState<NewsData | null>(null)
  const [showIcon, setShowIcon] = useState(false)
  const [iconVisible, setIconVisible] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogClosing, setDialogClosing] = useState(false)
  const retryCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchNews = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/news')
      if (!res.ok) return false
      const data = await res.json()
      if (data.news) {
        setNews(data.news)
        setShowIcon(true)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIconVisible(true))
        })
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const scheduleNextCheck = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const nextTime = getNextScheduleTime()
    const delay = nextTime.getTime() - Date.now() + SCHEDULE_DELAY_MS

    timerRef.current = setTimeout(() => {
      retryCountRef.current = 0
      fetchNews().then((found) => {
        if (!found) {
          const retry = () => {
            retryCountRef.current++
            if (retryCountRef.current >= MAX_RETRIES) {
              scheduleNextCheck()
              return
            }
            timerRef.current = setTimeout(() => {
              fetchNews().then((ok) => {
                if (!ok) retry()
                else scheduleNextCheck()
              })
            }, RETRY_INTERVAL_MS)
          }
          retry()
        } else {
          scheduleNextCheck()
        }
      })
    }, delay)
  }, [fetchNews])

  useEffect(() => {
    fetchNews().then(() => {
      scheduleNextCheck()
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fetchNews, scheduleNextCheck])

  const handleOpenDialog = useCallback(() => {
    setShowDialog(true)
    setIconVisible(false)
    setTimeout(() => setShowIcon(false), 300)
    fetch('/api/admin/news', { method: 'DELETE' }).catch(() => {})

    const { viewer } = homeStore.getState()
    viewer?.model?.playGesture('present', { holdDuration: 5.0 })
  }, [])

  const handleClose = useCallback(() => {
    setDialogClosing(true)
    setTimeout(() => {
      setShowDialog(false)
      setDialogClosing(false)
      setNews(null)
    }, 250)
  }, [])

  if (!news && !showDialog) return null

  return (
    <>
      {showIcon && (
        <button
          onClick={handleOpenDialog}
          className={`rounded-2xl text-sm p-2 text-center inline-flex items-center transition-opacity duration-300 ${iconVisible ? 'opacity-100 animate-notification-bell' : 'opacity-0'}`}
          style={{ backgroundColor: '#cc3355' }}
          aria-label="ニュース"
        >
          <Image
            src="/images/icons/news.svg"
            alt="ニュース"
            width={24}
            height={24}
            className="invert"
          />
        </button>
      )}

      {showDialog && news && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{
            animation: `${dialogClosing ? 'dialog-overlay-out 0.25s ease-in both' : 'dialog-overlay-in 0.3s ease-out both'}`,
          }}
          onClick={handleClose}
        >
          <div
            className="bg-white/85 backdrop-blur-sm rounded-lg max-w-2xl w-[90%] max-h-[80vh] flex flex-col mx-4 shadow-2xl"
            style={{
              animation: `${dialogClosing ? 'dialog-slide-down 0.25s ease-in both' : 'dialog-slide-up 0.4s ease-out both'}`,
              fontFamily: '"Noto Serif JP", "Georgia", serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー: 新聞マストヘッド */}
            <div className="flex-shrink-0 px-8 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                  <h2
                    className={`text-2xl font-bold text-gray-900 italic whitespace-nowrap ${cormorant.className}`}
                  >
                    TONaRi Times
                  </h2>
                  <p
                    className="text-xs text-gray-500 tracking-wider"
                    style={{ fontFamily: 'sans-serif' }}
                  >
                    {new Date(news.updatedAt).toLocaleDateString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="閉じる"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="4" y1="4" x2="16" y2="16" />
                    <line x1="16" y1="4" x2="4" y2="16" />
                  </svg>
                </button>
              </div>
              <hr
                className="border-gray-800 mt-3"
                style={{ borderTopWidth: '2px' }}
              />
            </div>
            {/* 本文 */}
            <div className="overflow-auto px-8 py-4 pb-8">
              <div className="whitespace-pre-wrap leading-[1.9] text-sm text-gray-800">
                {linkifyText(news.summary)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
