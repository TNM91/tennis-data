import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from '../_components/player-development-system'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Player Print Backup | TenAceIQ Player Development',
  description:
    'Optional TenAceIQ print backup pages for the Relentless Competitor development identity.',
  path: '/player-development/workbook',
  titleAbsolute: true,
})

export default function PlayerWorkbookPage() {
  return (
    <>
      <JsonLd
        id="player-development-workbook-breadcrumb-jsonld"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Player Development', path: '/player-development' },
          { name: 'Player Print Backup', path: '/player-development/workbook' },
        ])}
      />
      <PlayerDevelopmentSystem focus="workbook" />
    </>
  )
}
