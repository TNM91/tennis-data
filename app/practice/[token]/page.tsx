import type { Metadata } from 'next'
import PracticeRsvpClient from '@/app/pr/[code]/practice-rsvp-client'
import { buildCaptainShareMetadata } from '@/lib/captain-share-preview'

export const metadata: Metadata = buildCaptainShareMetadata({ kind: 'practice' })

export default async function PracticeRsvpFallbackPage({ params }: { params: Promise<{ token: string }> }) {
  return <PracticeRsvpClient token={(await params).token} />
}
