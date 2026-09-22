import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from '../_components/player-development-system'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Coach Planner | TenAceIQ Player Development',
  description:
    'Optional TenAceIQ coach planner print pages for the Relentless Competitor tennis development path.',
  path: '/player-development/coach-planner',
  titleAbsolute: true,
})

export default function CoachPlannerPage() {
  return (
    <>
      <JsonLd
        id="player-development-coach-planner-breadcrumb-jsonld"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Player Development', path: '/player-development' },
          { name: 'Coach Planner', path: '/player-development/coach-planner' },
        ])}
      />
      <PlayerDevelopmentSystem focus="coach" />
    </>
  )
}
