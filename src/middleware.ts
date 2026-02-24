import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_NAME = 'auth_token'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // /login is public
  if (pathname === '/login' || pathname === '/login/') {
    return NextResponse.next()
  }

  // Auth check (all pages)
  const password = process.env.ADMIN_PASSWORD || ''
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (!password || authToken !== password) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
