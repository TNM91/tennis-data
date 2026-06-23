import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from '../_components/player-development-system'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'

type IdentityPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return buildRouteMetadata({
    title: `${identity.title} | TenAceIQ Player Development`,
    description: `${identity.ratingBand} workbook and coach planner for ${identity.title}.`,
    path: `/player-development/${identity.slug}`,
    titleAbsolute: true,
  })
}

export default async function PlayerDevelopmentIdentityPage({ params }: IdentityPageProps) {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return (
    <>
      <JsonLd
        id="player-development-identity-breadcrumb-jsonld"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Player Development', path: '/player-development' },
          { name: identity.title, path: `/player-development/${identity.slug}` },
        ])}
      />
      <PlayerDevelopmentSystem identitySlug={slug} />
    </>
  )
}
