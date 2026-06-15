import type { Metadata } from 'next'
import {
  ActionGrid,
  AudiencePathGrid,
  CommandHero,
  HomeCtaGrid,
  PlatformPillarGrid,
  ProductPreviewGrid,
  PublicPageShell,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { PLATFORM_POSITIONING, PRODUCT_MOTTO } from '@/lib/product-story'

const homeDescription =
  'TenAceIQ helps the tennis community improve, compete, and manage the game with less friction.'

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
        url: '/og-image.png',
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
    images: ['/og-image.png'],
  },
}

export default function HomePage() {
  return (
    <PublicPageShell active="home">
      <main style={pageWrapStyle}>
        <CommandHero
          title="More Tennis. Less Chaos."
          body={PLATFORM_POSITIONING}
          primary={{ href: '/explore', label: 'Start Exploring' }}
          secondary={{ href: '/explore/players', label: 'Find Player Insights' }}
          searchPlaceholder="Search players, teams, leagues, tournaments, coaches, resources, or tennis actions"
          showBoard
        />
        <HomeCtaGrid />
        <PlatformPillarGrid />
        <AudiencePathGrid />
        <div id="what-next">
          <ActionGrid />
        </div>
        <ProductPreviewGrid />
      </main>
    </PublicPageShell>
  )
}
