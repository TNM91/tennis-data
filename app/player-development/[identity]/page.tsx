import type { Metadata } from 'next'
import PlayerDevelopmentSystem from '../_components/player-development-system'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'

type IdentityPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return {
    title: `${identity.title} | TenAceIQ Player Development`,
    description: `${identity.ratingBand} workbook and coach planner for ${identity.title}.`,
  }
}

export default async function PlayerDevelopmentIdentityPage({ params }: IdentityPageProps) {
  const { identity } = await params
  return <PlayerDevelopmentSystem identitySlug={identity} />
}
