import { useEffect } from 'react'

export const useTheme = () => {
  useEffect(() => {
    // Scenseiテーマを適用（固定）
    document.documentElement.setAttribute('data-theme', 'scensei')
  }, [])
}
