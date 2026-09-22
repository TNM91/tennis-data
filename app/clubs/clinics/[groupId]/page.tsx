import type { Metadata } from 'next'
import ClinicHub, { type ClinicTab } from '@/app/components/clinic-hub'
import SiteShell from '@/app/components/site-shell'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Clinic Hub',
  description: 'Keep clinic schedules, rosters, plans, attendance, updates, and player follow-through connected.',
  path: '/clubs/clinics',
})

export default async function ClubClinicPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ clubId?: string | string[]; tab?: string | string[] }> }) {
  const [{ groupId }, query] = await Promise.all([params, searchParams])
  const initialClubId = firstQueryValue(query.clubId)
  const requestedTab = firstQueryValue(query.tab)
  const initialTab: ClinicTab = requestedTab === 'schedule' || requestedTab === 'people' || requestedTab === 'plan' || requestedTab === 'messages' ? requestedTab : 'home'
  return (
    <SiteShell active="/clubs">
      <ClinicHub groupId={groupId} initialClubId={initialClubId} initialTab={initialTab} />
    </SiteShell>
  )
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}
