import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Perfume } from '../api/admin/perfumes'

const SEASONS = ['春', '夏', '秋', '冬']
const SCENES = [
  'デート',
  'オフィス',
  'カジュアル',
  'フォーマル',
  'ナイトアウト',
  'リラックス',
]

type FormData = {
  originalBrand?: string // 編集時の元のブランド名（キー変更検出用）
  originalName?: string // 編集時の元の商品名（キー変更検出用）
  brand: string
  name: string
  country: string
  topNotes: string
  middleNotes: string
  baseNotes: string
  scenes: string[]
  seasons: string[]
  impression: string
  rating: number
  createdAt?: string
}

// brand#name形式のIDを生成
const createPerfumeId = (brand: string, name: string): string => {
  return encodeURIComponent(`${brand}#${name}`)
}

const initialFormData: FormData = {
  brand: '',
  name: '',
  country: '',
  topNotes: '',
  middleNotes: '',
  baseNotes: '',
  scenes: [],
  seasons: [],
  impression: '',
  rating: 3,
}

type SortKey = 'brand' | 'name' | 'country' | 'rating'
type SortOrder = 'asc' | 'desc'

export default function AdminPerfumes() {
  const [perfumes, setPerfumes] = useState<Perfume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPerfume, setSelectedPerfume] = useState<Perfume | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('brand')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const router = useRouter()

  useEffect(() => {
    fetchPerfumes()
  }, [])

  const fetchPerfumes = async () => {
    try {
      const res = await fetch('/api/admin/perfumes')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setPerfumes(data.perfumes)
    } catch {
      setError('データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // ソートハンドラー
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // フィルター＆ソート済みデータ
  const filteredPerfumes = perfumes
    .filter((p) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        p.brand.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.topNotes.some((n) => n.toLowerCase().includes(q)) ||
        p.middleNotes.some((n) => n.toLowerCase().includes(q)) ||
        p.baseNotes.some((n) => n.toLowerCase().includes(q)) ||
        p.impression.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      switch (sortKey) {
        case 'brand':
        case 'name':
        case 'country':
          aVal = a[sortKey]
          bVal = b[sortKey]
          break
        case 'rating':
          aVal = a.rating
          bVal = b.rating
          break
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })

  // ソートアイコン（現在ソート中の列のみ表示）
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  const handleBack = () => {
    router.push('/admin')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const body = {
        country: formData.country,
        topNotes: formData.topNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        middleNotes: formData.middleNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        baseNotes: formData.baseNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        scenes: formData.scenes,
        seasons: formData.seasons,
        impression: formData.impression,
        rating: formData.rating,
        createdAt: formData.createdAt,
      }

      if (isEditing && formData.originalBrand && formData.originalName) {
        // 編集時：既存のアイテムを更新
        const id = createPerfumeId(
          formData.originalBrand,
          formData.originalName
        )
        const res = await fetch(`/api/admin/perfumes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to save')
      } else {
        // 新規作成
        const res = await fetch('/api/admin/perfumes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: formData.brand,
            name: formData.name,
            ...body,
          }),
        })
        if (!res.ok) throw new Error('Failed to save')
      }

      await fetchPerfumes()
      setShowForm(false)
      setFormData(initialFormData)
      setIsEditing(false)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (perfume: Perfume) => {
    setFormData({
      originalBrand: perfume.brand,
      originalName: perfume.name,
      brand: perfume.brand,
      name: perfume.name,
      country: perfume.country,
      topNotes: perfume.topNotes.join(', '),
      middleNotes: perfume.middleNotes.join(', '),
      baseNotes: perfume.baseNotes.join(', '),
      scenes: perfume.scenes,
      seasons: perfume.seasons,
      impression: perfume.impression,
      rating: perfume.rating,
      createdAt: perfume.createdAt,
    })
    setIsEditing(true)
    setShowForm(true)
  }

  const handleDelete = async (perfume: Perfume) => {
    if (!confirm('この香水を削除しますか？')) return

    try {
      const id = createPerfumeId(perfume.brand, perfume.name)
      const res = await fetch(`/api/admin/perfumes/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      await fetchPerfumes()
    } catch {
      setError('削除に失敗しました')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setFormData(initialFormData)
    setIsEditing(false)
  }

  const toggleArrayField = (field: 'scenes' | 'seasons', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
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
        <title>香水データ管理 - TONaRi</title>
      </Head>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow">
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
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 tracking-wider">
                PERFUMES
              </span>
            </div>
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
              title="戻る"
            >
              <svg
                className="w-5 h-5 text-gray-500 dark:text-gray-400"
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
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
              {error}
              <button
                onClick={() => setError('')}
                className="ml-2 text-red-800 dark:text-red-200 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {!showForm && (
            <div className="mb-4">
              <button
                onClick={() => setShowForm(true)}
                className="w-12 h-12 bg-secondary text-white rounded-full hover:bg-secondary-hover flex items-center justify-center transition-colors shadow-lg"
                title="新規追加"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          )}

          {showForm && (
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-bold dark:text-gray-100 mb-4">
                {isEditing ? '香水を編集' : '新規香水を追加'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ブランド名 *
                    </label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      商品名 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      生産国
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      トップノート（カンマ区切り）
                    </label>
                    <input
                      type="text"
                      value={formData.topNotes}
                      onChange={(e) =>
                        setFormData({ ...formData, topNotes: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ミドルノート（カンマ区切り）
                    </label>
                    <input
                      type="text"
                      value={formData.middleNotes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          middleNotes: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ベースノート（カンマ区切り）
                    </label>
                    <input
                      type="text"
                      value={formData.baseNotes}
                      onChange={(e) =>
                        setFormData({ ...formData, baseNotes: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      評価
                    </label>
                    <select
                      value={formData.rating}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rating: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {'★'.repeat(n)}
                          {'☆'.repeat(5 - n)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      季節
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SEASONS.map((season) => (
                        <button
                          key={season}
                          type="button"
                          onClick={() => toggleArrayField('seasons', season)}
                          className={`px-3 py-1 rounded-full text-sm ${
                            formData.seasons.includes(season)
                              ? 'bg-secondary text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {season}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      シーン
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SCENES.map((scene) => (
                        <button
                          key={scene}
                          type="button"
                          onClick={() => toggleArrayField('scenes', scene)}
                          className={`px-3 py-1 rounded-full text-sm ${
                            formData.scenes.includes(scene)
                              ? 'bg-secondary text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {scene}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      感想・コメント
                    </label>
                    <textarea
                      value={formData.impression}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          impression: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-hover disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 検索バー */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('brand')}
                  >
                    ブランド
                    <SortIcon column="brand" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('name')}
                  >
                    商品名
                    <SortIcon column="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('country')}
                  >
                    生産国
                    <SortIcon column="country" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('rating')}
                  >
                    評価
                    <SortIcon column="rating" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    トップ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    ミドル
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    ベース
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    季節
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPerfumes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      {searchQuery
                        ? '検索結果がありません'
                        : '香水データがありません。新規追加してください。'}
                    </td>
                  </tr>
                ) : (
                  filteredPerfumes.map((perfume) => (
                    <tr
                      key={`${perfume.brand}#${perfume.name}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setSelectedPerfume(perfume)}
                    >
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {perfume.brand}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {perfume.name}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
                        {perfume.country || '-'}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="text-yellow-500">
                          {'★'.repeat(perfume.rating)}
                          {'☆'.repeat(5 - perfume.rating)}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-600 dark:text-gray-400">
                        {perfume.topNotes[0] || '-'}
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-600 dark:text-gray-400">
                        {perfume.middleNotes[0] || '-'}
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-600 dark:text-gray-400">
                        {perfume.baseNotes[0] || '-'}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {perfume.seasons.map((season) => (
                            <span
                              key={season}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded"
                            >
                              {season}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right w-24 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(perfume)
                          }}
                          className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex items-center justify-center transition-colors mr-1"
                          title="編集"
                        >
                          <svg
                            className="w-4 h-4 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(perfume)
                          }}
                          className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 inline-flex items-center justify-center transition-colors"
                          title="削除"
                        >
                          <svg
                            className="w-4 h-4 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* 詳細ダイアログ */}
      {selectedPerfume && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPerfume(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedPerfume.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedPerfume.brand}
                    {selectedPerfume.country && ` / ${selectedPerfume.country}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPerfume(null)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
                >
                  <svg
                    className="w-5 h-5 text-gray-400 dark:text-gray-500"
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

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 text-lg">
                    {'★'.repeat(selectedPerfume.rating)}
                    {'☆'.repeat(5 - selectedPerfume.rating)}
                  </span>
                </div>

                {selectedPerfume.seasons.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      SEASON
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPerfume.seasons.map((season) => (
                        <span
                          key={season}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded"
                        >
                          {season}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPerfume.scenes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      SCENE
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPerfume.scenes.map((scene) => (
                        <span
                          key={scene}
                          className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-xs rounded"
                        >
                          {scene}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPerfume.topNotes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      TOP NOTES
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedPerfume.topNotes.join(', ')}
                    </p>
                  </div>
                )}

                {selectedPerfume.middleNotes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      MIDDLE NOTES
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedPerfume.middleNotes.join(', ')}
                    </p>
                  </div>
                )}

                {selectedPerfume.baseNotes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      BASE NOTES
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedPerfume.baseNotes.join(', ')}
                    </p>
                  </div>
                )}

                {selectedPerfume.impression && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      IMPRESSION
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedPerfume.impression}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => {
                    handleEdit(selectedPerfume)
                    setSelectedPerfume(null)
                  }}
                  className="px-4 py-2 text-sm bg-secondary text-white rounded-lg hover:bg-secondary-hover transition-colors"
                >
                  編集
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
