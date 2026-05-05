'use client'

export const dynamic = 'force-dynamic'

import { LeagueCoordinatorWorkspace } from '@/app/captain/season-dashboard/page'

export default function LeagueCoordinatorPage() {
  return <LeagueCoordinatorWorkspace activeRoute="/league-coordinator" />
}
