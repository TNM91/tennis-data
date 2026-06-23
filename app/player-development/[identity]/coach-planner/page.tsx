import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from '../../_components/player-development-system'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'

type IdentityCoachPlannerPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityCoachPlannerPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return buildRouteMetadata({
    title: `${identity.title} Coach Planner | TenAceIQ Player Development`,
    description: `Printable TenAceIQ coach planner pages for ${identity.title}.`,
    path: `/player-development/${identity.slug}/coach-planner`,
    titleAbsolute: true,
  })
}

export default async function IdentityCoachPlannerPage({ params }: IdentityCoachPlannerPageProps) {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return (
    <>
      <JsonLd
        id="player-development-identity-coach-planner-breadcrumb-jsonld"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Player Development', path: '/player-development' },
          { name: identity.title, path: `/player-development/${identity.slug}` },
          { name: 'Coach Planner', path: `/player-development/${identity.slug}/coach-planner` },
        ])}
      />
      <PlayerDevelopmentSystem focus="coach" identitySlug={slug} />
    </>
  )
}
