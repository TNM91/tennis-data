import type { Metadata } from 'next'
import {
  ActionGrid,
  CommandHero,
  PlatformPillarGrid,
  ProductPreviewGrid,
  PublicPageShell,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { HOME_HERO_STORY, PLATFORM_POSITIONING, PRODUCT_MOTTO } from '@/lib/product-story'

const homeDescription =
  'TenAceIQ helps the tennis community improve, compete, and manage the game with less friction.'
const socialBrandImage = '/tenaceiq/logos/tenaceiq-social-preview.png'

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
        width: 1731,
        height: 909,
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
        <CommandHero
          title={`${HOME_HERO_STORY.headlineTop} ${HOME_HERO_STORY.headlineBottom}`}
          body={`${HOME_HERO_STORY.body} ${PLATFORM_POSITIONING}`}
          primary={{ href: '/explore', label: 'Start Exploring' }}
          secondary={{ href: '/explore/players', label: 'Find Player Insights' }}
          searchPlaceholder="Search players, teams, leagues, tournaments, coaches, resources, or tennis actions"
          searchCompact
          showSearchResults={false}
          showBoard
        />
        <p style={homeTierPromiseStyle}>
          Start free, then unlock My Lab, Coach Hub, Team Hub, League Office, or Full-Court when your game, team, players, league, or tournament needs more support.
        </p>
        <div id="what-next">
          <ActionGrid />
        </div>
        <PlatformPillarGrid />
        <ProductPreviewGrid />
      </main>
    </PublicPageShell>
  )
}

const homeTierPromiseStyle = {
  margin: '-8px 0 0',
  color: 'var(--muted-strong)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 760,
  maxWidth: 860,
}
