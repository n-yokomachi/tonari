import { useState, useEffect } from 'react'

/**
 * メディアクエリの状態を監視するカスタムフック
 * @param query メディアクエリ文字列 (例: '(max-width: 767px)')
 * @returns クエリがマッチしているかどうか（SSR時はnull）
 */
export const useMediaQuery = (query: string): boolean | null => {
  const [matches, setMatches] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

// 便利なプリセット
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () =>
  useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useIsPortrait = () =>
  useMediaQuery('(orientation: portrait) and (min-width: 768px)')
