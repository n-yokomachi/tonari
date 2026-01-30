import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const ADMIN_COOKIE_NAME = 'admin_token'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 管理画面の認証チェック（ログインページ以外）
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value

    // 未認証の場合はログインページにリダイレクト
    if (!ADMIN_PASSWORD || adminToken !== ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    return NextResponse.next()
  }

  // ログインページは認証なしで通す
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next()
  }

  // ベーシック認証が無効な場合はスキップ
  const username = process.env.BASIC_AUTH_USERNAME
  const password = process.env.BASIC_AUTH_PASSWORD

  if (!username || !password) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ')

    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded)
      const [user, pass] = decoded.split(':')

      if (user === username && pass === password) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
