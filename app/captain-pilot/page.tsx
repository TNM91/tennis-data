import type { Metadata } from 'next'
import { CAPTAIN_PILOT_SHARE } from '@/lib/captain-pilot-share'
import CaptainPilotClient from './captain-pilot-client'
import { buildCaptainPilotTrialEnd } from '@/lib/captain-pilot'

export const metadata: Metadata = {
  title: CAPTAIN_PILOT_SHARE.title,
  description: CAPTAIN_PILOT_SHARE.description,
  alternates: { canonical: CAPTAIN_PILOT_SHARE.url },
  openGraph: {
    type: 'website',
    siteName: 'TenAceIQ',
    url: CAPTAIN_PILOT_SHARE.url,
    title: CAPTAIN_PILOT_SHARE.title,
    description: CAPTAIN_PILOT_SHARE.description,
    images: [{ url: CAPTAIN_PILOT_SHARE.image, width: 1200, height: 630, alt: CAPTAIN_PILOT_SHARE.imageAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: CAPTAIN_PILOT_SHARE.title,
    description: CAPTAIN_PILOT_SHARE.description,
    images: [{ url: CAPTAIN_PILOT_SHARE.image, alt: CAPTAIN_PILOT_SHARE.imageAlt }],
  },
}

export const dynamic = 'force-dynamic'

export default function CaptainPilotPage() {
  const renewalDateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(buildCaptainPilotTrialEnd() * 1000))

  return <CaptainPilotClient renewalDateLabel={renewalDateLabel} />
}
