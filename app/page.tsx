import type { Metadata } from 'next'
import {
  ActionGrid,
  CommandHero,
  ProductPreviewGrid,
  PublicPageShell,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { PRODUCT_MOTTO } from '@/lib/product-story'

const homeDescription =
  'Find players, teams, coaches, tournaments, leagues, match prep, and the next useful tennis action in one TenAceIQ command center.'

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
          body="Whether you want to check stats, improve your game, prep a matchup, simplify captaining, find coaching help, or run a league, TenAceIQ keeps the next tennis move in one place."
          secondary={{ href: '#what-next', label: 'See What TenAceIQ Can Help With' }}
          showBoard={false}
        />
        <div id="what-next">
          <ActionGrid />
        </div>
        <ProductPreviewGrid />
      </main>
    </PublicPageShell>
  )
}
