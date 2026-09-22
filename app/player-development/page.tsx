import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from './_components/player-development-system'
import { isPlayerStyleSlug, PLAYER_STYLE_COOKIE } from '@/lib/player-identity-selection'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Player Development System | TenAceIQ',
  description:
    'Phone-first Level Up paths, on-court tennis drills, quick proof scores, and My Lab check-ins for competitive player development.',
  path: '/player-development',
  titleAbsolute: true,
})

export default async function PlayerDevelopmentPage() {
  const savedStyle = (await cookies()).get(PLAYER_STYLE_COOKIE)?.value
  const defaultIdentitySlug = isPlayerStyleSlug(savedStyle) ? savedStyle : undefined

  return (
    <>
      <JsonLd
        id="player-development-breadcrumb-jsonld"
        data={buildPublicSectionBreadcrumbJsonLd('Player Development', '/player-development')}
      />
      <PlayerDevelopmentSystem defaultIdentitySlug={defaultIdentitySlug} />
    </>
  )
}
