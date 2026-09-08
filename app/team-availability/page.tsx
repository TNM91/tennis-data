import type { Metadata } from 'next'
import { AuthProvider } from '@/app/components/auth-provider'
import TeamAvailabilityClient from './team-availability-client'

export const metadata: Metadata = { title: 'Team availability | TenAceIQ', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default async function TeamAvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const key of ['team', 'league', 'flight', 'seasonKey', 'match']) {
    const value = params[key]
    if (typeof value === 'string') query.set(key, value)
  }
  return <AuthProvider><TeamAvailabilityClient query={`?${query}`} /></AuthProvider>
}
