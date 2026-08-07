import type { Metadata } from 'next'
import ClinicHub from '@/app/components/clinic-hub'
import SiteShell from '@/app/components/site-shell'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Clinic Hub',
  description: 'Keep clinic schedules, rosters, plans, attendance, updates, and player follow-through connected.',
  path: '/clubs/clinics',
})

export default async function ClubClinicPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  return (
    <SiteShell active="/clubs">
      <ClinicHub groupId={groupId} />
    </SiteShell>
  )
}
