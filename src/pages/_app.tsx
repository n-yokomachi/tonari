import type { AppProps } from 'next/app'
import React, { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'

import { isLanguageSupported } from '@/features/constants/settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/styles/globals.css'
import '@/styles/themes.css'
import migrateStore from '@/utils/migrateStore'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const hs = homeStore.getState()
    const ss = settingsStore.getState()

    if (!hs.userOnboarded) {
      migrateStore()

      const browserLanguage = navigator.language
      const languageCode = browserLanguage.match(/^zh/i)
        ? 'zh'
        : browserLanguage.split('-')[0].toLowerCase()

      let language = ss.selectLanguage
      if (!language) {
        language = isLanguageSupported(languageCode) ? languageCode : 'ja'
      }
      i18n.changeLanguage(language)
      settingsStore.setState({ selectLanguage: language })
      homeStore.setState({ userOnboarded: true })
    } else {
      i18n.changeLanguage(ss.selectLanguage)
    }

    // 初期テーマを適用
    document.documentElement.setAttribute('data-theme', ss.colorTheme)
    if (ss.colorTheme === 'tonari-dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // テーマ変更をリアルタイムに反映
    const unsub = settingsStore.subscribe((state) => {
      document.documentElement.setAttribute('data-theme', state.colorTheme)
      if (state.colorTheme === 'tonari-dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    })
    return () => unsub()
  }, [])

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
