import type { Metadata } from 'next'
import {
  CommandHero,
  PublicPageShell,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import GuestTierPreviewGate from '@/app/components/guest-tier-preview-gate'
import ActiveTeamChallengeCard from '@/app/components/active-team-challenge-card'
import { HOME_HERO_STORY, PRODUCT_MOTTO } from '@/lib/product-story'

const homeDescription =
  'TenAceIQ helps the tennis community improve, compete, and manage the game with less friction.'
const socialBrandImage = '/brand/social/og-image-1200x630.png'

export const metadata: Metadata = {
  title: PRODUCT_MOTTO,
  description: homeDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `TenAceIQ | ${PRODUCT_MOTTO}`,
    description: homeDescription,
    url: '/',
    images: [
      {
        url: socialBrandImage,
        width: 1200,
        height: 630,
        alt: 'TenAceIQ: More Tennis. Less Chaos.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `TenAceIQ | ${PRODUCT_MOTTO}`,
    description: homeDescription,
    images: [socialBrandImage],
  },
}

export default function HomePage() {
  return (
    <PublicPageShell active="home">
      <main style={pageWrapStyle}>
        <ActiveTeamChallengeCard />
        <CommandHero
          title={`${HOME_HERO_STORY.headlineTop} ${HOME_HERO_STORY.headlineBottom}`}
          body="Search players, teams, leagues, rankings, and tournaments for free. Add the right tools when you want help with your game, team, players, or competition."
          primary={{ href: '/explore', label: 'Start Exploring' }}
          secondary={{ href: '/pricing', label: 'See Plans' }}
          searchPlaceholder="Search players, teams, leagues, tournaments, or coaches"
          searchCompact
          showSearchResults={false}
          showBoard={false}
        />
        <GuestTierPreviewGate />
      </main>
    </PublicPageShell>
  )
}
