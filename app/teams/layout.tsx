import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { PublicCompetitionContentProvider } from '@/app/components/public-competition-content-context'
import { PublicTeamsSnapshot } from '@/app/components/public-competition-evidence'

export const revalidate = 86400

export const metadata: Metadata = buildRouteMetadata({
  title: 'Teams',
  description:
    'Team tennis without the group-text chaos. Find teams, follow rosters, scout opponents, and open Captain Tools for match week.',
  path: '/teams',
})

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return <PublicCompetitionContentProvider teamsContent={<PublicTeamsSnapshot />}>{children}</PublicCompetitionContentProvider>
}
