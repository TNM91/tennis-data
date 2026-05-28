import type { Metadata } from 'next'
import PlayerDevelopmentSystem from '../../_components/player-development-system'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'

type IdentityCoachPlannerPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityCoachPlannerPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return {
    title: `${identity.title} Coach Planner | TenAceIQ Player Development`,
    description: `Printable TenAceIQ coach planner pages for ${identity.title}.`,
  }
}

export default async function IdentityCoachPlannerPage({ params }: IdentityCoachPlannerPageProps) {
  const { identity } = await params
  return <PlayerDevelopmentSystem focus="coach" identitySlug={identity} />
}
