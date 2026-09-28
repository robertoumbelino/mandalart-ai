import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth'
import HomeApp from './HomeApp'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams
  const loginIntent = query.entrar === '1'
  if (!loginIntent && !(await getCurrentUser())) {
    const params = new URLSearchParams()
    for (const [key, values] of Object.entries(query)) {
      if (key === 'entrar' || key === 'continuar') continue
      for (const value of Array.isArray(values) ? values : values ? [values] : [])
        params.append(key, value)
    }
    redirect(`/comecar${params.size ? `?${params}` : ''}`)
  }
  return <HomeApp loginIntent={loginIntent} />
}
