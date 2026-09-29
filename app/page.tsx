import { getCurrentUser } from '@/actions/auth'
import HomeApp from './HomeApp'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams
  const loginIntent = query.entrar === '1'
  const user = await getCurrentUser()
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(query)) {
    if (key === 'entrar' || key === 'continuar') continue
    for (const value of Array.isArray(values) ? values : values ? [values] : [])
      params.append(key, value)
  }
  params.set('iniciar', '1')
  return <HomeApp loginIntent={loginIntent} initialVisitor={!user} onboardingHref={`/comecar${params.size ? `?${params}` : ''}`} />
}
