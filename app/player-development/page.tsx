import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from './_components/player-development-system'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Player Development System | TenAceIQ',
  description:
    'Printable workbook paths, coach planner sheets, weekly goals, match evidence, and My Lab check-ins for competitive tennis player development.',
  path: '/player-development',
  titleAbsolute: true,
})

export default function PlayerDevelopmentPage() {
  return (
    <>
      <JsonLd
        id="player-development-breadcrumb-jsonld"
        data={buildPublicSectionBreadcrumbJsonLd('Player Development', '/player-development')}
      />
      <PlayerDevelopmentSystem />
    </>
  )
}
