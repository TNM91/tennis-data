import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import LevelUpPageContent from '../level-up-page-content'
import { PLAYER_DEVELOPMENT_IDENTITIES } from '@/lib/player-development'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { isPlayerStyleSlug, PLAYER_STYLE_COOKIE } from '@/lib/player-identity-selection'

type IdentityLevelUpPageProps = {
  params: Promise<{ identity: string }>
}

export function generateStaticParams() {
  return PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => ({ identity: identity.slug }))
}

function getPublicLevelUpIdentity(slug: string) {
  return PLAYER_DEVELOPMENT_IDENTITIES.find((identity) => identity.slug === slug)
}

export async function generateMetadata({ params }: IdentityLevelUpPageProps): Promise<Metadata> {
  const { identity: slug } = await params
  const identity = getPublicLevelUpIdentity(slug)

  if (!identity) {
    return {}
  }

  return buildRouteMetadata({
    title: `${identity.title.replace(/^The /, '')} Level Up | TenAceIQ`,
    description: `Choose a ${identity.title.replace(/^The /, '')} focus, start a drill, use the timer, and save a quick Level Up check-in.`,
    path: `/level-up/${identity.slug}`,
    titleAbsolute: true,
  })
}

export default async function IdentityLevelUpPage({ params }: IdentityLevelUpPageProps) {
  const { identity: slug } = await params
  const identity = getPublicLevelUpIdentity(slug)

  if (!identity) {
    notFound()
  }

  const savedStyle = (await cookies()).get(PLAYER_STYLE_COOKIE)?.value
  return (
    <LevelUpPageContent
      identity={identity}
      initialSavedStyleSlug={isPlayerStyleSlug(savedStyle) ? savedStyle : null}
    />
  )
}
