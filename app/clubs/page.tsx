import type { Metadata } from 'next'
import { Suspense } from 'react'
import ClubWorkspace from '@/app/components/club-workspace'
import SiteShell from '@/app/components/site-shell'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Club',
  description: 'Keep your club roster, coaching groups, leagues, tournaments, and public club home connected.',
  path: '/clubs',
})

export default function ClubsPage() {
  return (
    <SiteShell active="/clubs">
      <Suspense fallback={null}>
        <ClubWorkspace />
      </Suspense>
    </SiteShell>
  )
}
