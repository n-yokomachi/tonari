import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import Image from 'next/image'
import { IconButton } from './iconButton'

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
  const [showDialog, setShowDialog] = useState(false)
  const retryCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchNews = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/news')
      if (!res.ok) return false
      const data = await res.json()
      if (data.news) {
        setNews(data.news)
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

  const handleClose = useCallback(async () => {
    setShowDialog(false)
    try {
      await fetch('/api/admin/news', { method: 'DELETE' })
      setNews(null)
    } catch {
      // ignore
    }
  }, [])

  if (!news && !showDialog) return null

  return (
    <>
      {news && (
        <button
          onClick={() => setShowDialog(true)}
          className="rounded-2xl text-sm p-2 text-center inline-flex items-center transition-all duration-200 animate-notification-bell"
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
        <div className="fixed inset-0 z-40 bg-white/80 backdrop-blur">
          <div className="absolute m-6 z-15">
            <IconButton
              iconName="24/Close"
              isProcessing={false}
              onClick={handleClose}
            />
          </div>
          <main className="max-h-full overflow-auto">
            <div className="text-text1 max-w-3xl mx-auto px-6 py-20">
              <h2 className="text-2xl font-bold mb-2">ニュース</h2>
              <p className="text-sm text-gray-500 mb-6">
                {new Date(news.updatedAt).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })}
              </p>
              <div className="whitespace-pre-wrap leading-relaxed text-base">
                {linkifyText(news.summary)}
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  )
}
