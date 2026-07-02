import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import PlayerDevelopmentSystem from '../../_components/player-development-system'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'

type IdentityWorkbookPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityWorkbookPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return buildRouteMetadata({
    title: `${identity.title} Print Backup | TenAceIQ Player Development`,
    description: `Optional TenAceIQ print backup pages for ${identity.title}.`,
    path: `/player-development/${identity.slug}/workbook`,
    titleAbsolute: true,
  })
}

export default async function IdentityWorkbookPage({ params }: IdentityWorkbookPageProps) {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return (
    <>
      <JsonLd
        id="player-development-identity-workbook-breadcrumb-jsonld"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Player Development', path: '/player-development' },
          { name: identity.title, path: `/player-development/${identity.slug}` },
          { name: 'Print Backup', path: `/player-development/${identity.slug}/workbook` },
        ])}
      />
      <PlayerDevelopmentSystem focus="workbook" identitySlug={slug} />
    </>
  )
}
