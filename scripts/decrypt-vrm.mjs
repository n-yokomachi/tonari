/**
 * Vercel ビルド時に git-crypt で暗号化されたファイルを復号する Node.js スクリプト
 * 環境変数 GIT_CRYPT_KEY に base64 エンコードされたキーファイルが必要
 *
 * git-crypt 暗号化フォーマット:
 *   [10-byte header: \x00GITCRYPT\x00]
 *   [4-byte key_version (big-endian)]
 *   [12-byte nonce]
 *   [ciphertext]
 *   [10-byte HMAC-SHA1 truncated]
 *
 * キーファイルフォーマット:
 *   繰り返し: [4-byte field_id][4-byte field_len][field_data]
 *   field_id=0: 終端, field_id=3: AES鍵(32bytes), field_id=5: HMAC鍵(64bytes)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createDecipheriv, createHmac } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const HEADER = Buffer.from('\x00GITCRYPT\x00')
const HEADER_LEN = 10
const KEY_VERSION_LEN = 4
const NONCE_LEN = 12
const HMAC_LEN = 10

function parseKeyFile(keyBuf) {
  let offset = 0
  let aesKey = null
  let hmacKey = null

  while (offset < keyBuf.length) {
    if (offset + 4 > keyBuf.length) break
    const fieldId = keyBuf.readUInt32BE(offset)
    offset += 4

    if (fieldId === 0) break // KEY_FIELD_END

    if (offset + 4 > keyBuf.length) break
    const fieldLen = keyBuf.readUInt32BE(offset)
    offset += 4

    if (offset + fieldLen > keyBuf.length) break
    const fieldData = keyBuf.subarray(offset, offset + fieldLen)
    offset += fieldLen

    if (fieldId === 3) aesKey = fieldData // KEY_FIELD_AES_KEY
    if (fieldId === 5) hmacKey = fieldData // KEY_FIELD_HMAC_KEY
  }

  if (!aesKey || !hmacKey) {
    throw new Error('Invalid git-crypt key file: missing AES or HMAC key')
  }

  return { aesKey, hmacKey }
}

function decryptFile(encryptedBuf, aesKey, hmacKey) {
  // ヘッダー検証
  if (
    encryptedBuf.length < HEADER_LEN + KEY_VERSION_LEN + NONCE_LEN + HMAC_LEN
  ) {
    return null // 暗号化されていない（短すぎる）
  }
  if (!encryptedBuf.subarray(0, HEADER_LEN).equals(HEADER)) {
    return null // git-crypt ヘッダーがない → 暗号化されていない
  }

  const offset = HEADER_LEN + KEY_VERSION_LEN
  const nonce = encryptedBuf.subarray(offset, offset + NONCE_LEN)
  const ciphertext = encryptedBuf.subarray(
    offset + NONCE_LEN,
    encryptedBuf.length - HMAC_LEN
  )
  const storedHmac = encryptedBuf.subarray(encryptedBuf.length - HMAC_LEN)

  // AES-256-CTR で復号（IV = 12-byte nonce + 4-byte zero counter）
  const iv = Buffer.alloc(16)
  nonce.copy(iv, 0)

  const decipher = createDecipheriv('aes-256-ctr', aesKey, iv)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  // HMAC-SHA1 検証
  const computedHmac = createHmac('sha1', hmacKey).update(plaintext).digest()
  if (!computedHmac.subarray(0, HMAC_LEN).equals(storedHmac)) {
    throw new Error('HMAC verification failed - key may be incorrect')
  }

  return plaintext
}

function getEncryptedFiles() {
  const gitattributesPath = resolve(projectRoot, '.gitattributes')
  if (!existsSync(gitattributesPath)) return []

  const content = readFileSync(gitattributesPath, 'utf-8')
  return content
    .split('\n')
    .filter((line) => line.includes('filter=git-crypt'))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean)
}

// メイン処理
const keyBase64 = process.env.GIT_CRYPT_KEY
if (!keyBase64) {
  console.log('GIT_CRYPT_KEY not set, skipping VRM decryption')
  process.exit(0)
}

const keyBuf = Buffer.from(keyBase64, 'base64')
const { aesKey, hmacKey } = parseKeyFile(keyBuf)
console.log('Parsed git-crypt key successfully')

const files = getEncryptedFiles()
console.log(`Found ${files.length} encrypted file(s): ${files.join(', ')}`)

let decrypted = 0
for (const relPath of files) {
  const filePath = resolve(projectRoot, relPath)
  if (!existsSync(filePath)) {
    console.log(`  Skip: ${relPath} (not found)`)
    continue
  }

  const encrypted = readFileSync(filePath)
  const plaintext = decryptFile(encrypted, aesKey, hmacKey)

  if (plaintext === null) {
    console.log(`  Skip: ${relPath} (not encrypted or already decrypted)`)
    continue
  }

  writeFileSync(filePath, plaintext)
  console.log(`  Decrypted: ${relPath} (${encrypted.length} -> ${plaintext.length} bytes)`)
  decrypted++
}

console.log(`VRM decryption complete: ${decrypted}/${files.length} files decrypted`)
