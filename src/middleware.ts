import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_NAME = 'auth_token'

async function hashToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // /login is public
  if (pathname === '/login' || pathname === '/login/') {
    return NextResponse.next()
  }

  // Auth check (all pages)
  const password = process.env.ADMIN_PASSWORD || ''
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (!password || authToken !== (await hashToken(password))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw\\.js).*)'],
}
