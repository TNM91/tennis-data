import type { Metadata } from 'next'
import PlayerDevelopmentSystem from '../../_components/player-development-system'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'

type IdentityWorkbookPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityWorkbookPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return {
    title: `${identity.title} Workbook | TenAceIQ Player Development`,
    description: `Printable TenAceIQ workbook pages for ${identity.title}.`,
  }
}

export default async function IdentityWorkbookPage({ params }: IdentityWorkbookPageProps) {
  const { identity } = await params
  return <PlayerDevelopmentSystem focus="workbook" identitySlug={identity} />
}
