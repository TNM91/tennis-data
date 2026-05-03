import type { Metadata } from 'next'
import PreviewHomepage from '@/app/components/preview-homepage'

const homeDescription =
  'Search tennis for free, then choose the TenAceIQ Player, Captain, or League Coordinator tier for personal prep, team decisions, and league operations.'

export const metadata: Metadata = {
  title: 'Premium Tennis Intelligence by Tier',
  description: homeDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'TenAceIQ | Premium Tennis Intelligence by Tier',
    description: homeDescription,
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TenAceIQ premium tennis intelligence by tier',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenAceIQ | Premium Tennis Intelligence by Tier',
    description: homeDescription,
    images: ['/og-image.png'],
  },
}

export default function HomePage() {
  return <PreviewHomepage />
}
