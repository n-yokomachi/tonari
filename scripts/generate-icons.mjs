/**
 * PWAアイコン生成スクリプト
 *
 * 使い方: node scripts/generate-icons.mjs <元画像パス>
 * 例:     node scripts/generate-icons.mjs assets/app-icon.png
 *
 * 512x512以上の正方形PNG画像を指定してください。
 * public/icons/ に 192x192 と 512x512 のアイコンを生成します。
 */

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputDir = path.join(projectRoot, 'public', 'icons')

const SIZES = [192, 512]

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: node scripts/generate-icons.mjs <source-image>')
    console.error('Example: node scripts/generate-icons.mjs assets/app-icon.png')
    process.exit(1)
  }

  const absoluteInput = path.resolve(inputPath)

  for (const size of SIZES) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)
    await sharp(absoluteInput)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outputPath)
    console.log(`Generated: ${outputPath}`)
  }

  console.log('Done!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
