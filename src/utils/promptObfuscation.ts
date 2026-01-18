// Simple obfuscation for prompts - not cryptographically secure,
// but prevents casual reading of prompts in GitHub files

/**
 * Decode a Base64 encoded string back to original
 * Works in both Node.js and browser environments
 */
export function decodePrompt(encoded: string): string {
  try {
    // Use atob for browser, Buffer for Node.js
    if (typeof window !== 'undefined' && typeof atob === 'function') {
      return decodeURIComponent(
        atob(encoded)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    }
    return Buffer.from(encoded, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}
