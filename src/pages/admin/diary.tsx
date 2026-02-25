import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

type DiaryEntry = {
  date: string
  body?: string
  createdAt: string
}

export default function AdminDiary() {
  const [diaries, setDiaries] = useState<DiaryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDiary, setSelectedDiary] = useState<DiaryEntry | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchDiaries()
  }, [])

  const fetchDiaries = async () => {
    try {
      const res = await fetch('/api/admin/diary')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDiaries(data.diaries)
    } catch {
      setError('日記の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDiaryDetail = async (date: string) => {
    setIsLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/diary/${date}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSelectedDiary(data.diary)
    } catch {
      setError('日記の詳細取得に失敗しました')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    return `${y}年${parseInt(m)}月${parseInt(d)}日`
  }

  const truncate = (text: string, max: number) => {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-secondary"
              style={{
                animation: 'bounce 0.6s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <style jsx>{`
          @keyframes bounce {
            0%,
            100% {
              transform: translateY(0) scale(1);
              opacity: 0.7;
            }
            50% {
              transform: translateY(-12px) scale(1.1);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>日記管理 - TONaRi</title>
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span className="text-sm font-medium text-gray-600 tracking-wider">
                DIARY
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

        <main className="max-w-7xl mx-auto px-4 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
              <button
                onClick={() => setError('')}
                className="ml-2 text-red-800 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {diaries.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              まだ日記がありません
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
              {diaries.map((diary) => (
                <button
                  key={diary.date}
                  onClick={() => fetchDiaryDetail(diary.date)}
                  className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {formatDate(diary.date)}
                    </p>
                    {diary.body && (
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        {truncate(diary.body, 60)}
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Detail dialog */}
      {selectedDiary && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDiary(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingDetail ? (
              <div className="p-6 flex items-center justify-center">
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-secondary"
                      style={{
                        animation: 'bounce 0.6s ease-in-out infinite',
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-lg font-bold text-gray-900">
                    {formatDate(selectedDiary.date)}
                  </p>
                  <button
                    onClick={() => setSelectedDiary(null)}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedDiary.body}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
