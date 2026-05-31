import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import LevelUpPortal from '@/app/player-development/_components/level-up-portal'
import styles from '@/app/player-development/_components/player-development.module.css'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { buildRouteMetadata } from '@/lib/route-metadata'

type IdentityLevelUpPortalPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

export async function generateMetadata({ params }: IdentityLevelUpPortalPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return buildRouteMetadata({
    title: `${identity.title.replace(/^The /, '')} Level Up Portal | TenAceIQ`,
    description: `Coach-assigned, identity-recommended, and player-favorited Level Up tools for ${identity.title.replace(/^The /, '')}.`,
    path: `/player-development/${identity.slug}/level-up`,
  })
}

export default async function IdentityLevelUpPortalPage({ params }: IdentityLevelUpPortalPageProps) {
  const { identity: slug } = await params
  const identity = getPlayerDevelopmentIdentity(slug)

  return (
    <SiteShell active="/mylab">
      <main className={`${styles.shell} ${styles.levelUpShell}`}>
        <LevelUpPortal identitySlug={identity.slug} identityTitle={identity.title} />
      </main>
    </SiteShell>
  )
}
