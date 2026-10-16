import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Verifies the session with Supabase and refreshes the cookie if needed
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const redirectTo = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach((c) => r.cookies.set(c)) // keep refreshed cookies
    return r
  }

  const PROTECTED = ['/dashboard', '/play']
  if (!user && PROTECTED.some((p) => path.startsWith(p))) return redirectTo('/')
  if (user && path === '/') return redirectTo('/dashboard')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}