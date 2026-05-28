import type { Metadata } from 'next'
import PreviewHomepage from '@/app/components/preview-homepage'
import { PRODUCT_MOTTO } from '@/lib/product-story'

const homeDescription =
  'More Tennis. Less Chaos. Search tennis for free, then open TenAceIQ workspaces for players, captains, league coordinators, and Full-Court operations.'

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
  return <PreviewHomepage />
}
