import type { Metadata } from 'next'
import {
  CommandHero,
  HomeClosingBand,
  HomeIntelligenceSnapshot,
  HomeModeRouter,
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
        <div id="what-next">
          <HomeIntelligenceSnapshot />
        </div>
        <HomeModeRouter />
        <HomeClosingBand />
      </main>
    </PublicPageShell>
  )
}
