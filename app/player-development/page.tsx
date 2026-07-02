import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from './_components/player-development-system'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Player Development System | TenAceIQ',
  description:
    'Phone-first Level Up paths, on-court tennis drills, quick proof scores, and My Lab check-ins for competitive player development.',
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
