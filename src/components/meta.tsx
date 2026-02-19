import Head from 'next/head'
export const Meta = () => {
  const title = 'Tonari'
  const description = 'あなたの暮らしに寄り添うパーソナルAIアシスタント'
  const imageUrl = '/ogp.png'
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Head>
  )
}
