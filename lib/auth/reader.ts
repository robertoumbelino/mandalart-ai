import 'server-only'
import { cookies, headers } from 'next/headers'
import { createAuthServer, extractNeonAuthCookies, NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server'

// Server Components cannot persist upstream Set-Cookie headers. Keep this
// instance private and expose only reads; mutations use auth/server.ts.
const reader = createAuthServer({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
  context: async () => {
    const jar = await cookies()
    const requestHeaders = await headers()
    return {
      // Unlike the original Cookie header, this reflects cookies removed by
      // a Server Action before Next renders the page again in the same request.
      getCookies: () => extractNeonAuthCookies(jar.toString()),
      setCookie: () => {},
      getHeader: name => requestHeaders.get(name),
      getOrigin: () => requestHeaders.get('origin') || requestHeaders.get('referer')?.split('/').slice(0, 3).join('/') || '',
      getFramework: () => 'nextjs',
    }
  },
})

export async function readAuthSession() {
  if (!(await cookies()).get(NEON_AUTH_SESSION_COOKIE_NAME)?.value) {
    return { data: null, error: null }
  }
  return reader.getSession()
}

export async function readAuthAccounts() {
  return reader.listAccounts()
}
