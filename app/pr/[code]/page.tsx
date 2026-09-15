import type { Metadata } from 'next'
import PracticeRsvpClient from './practice-rsvp-client'
import { buildCaptainShareMetadata } from '@/lib/captain-share-preview'

export const metadata: Metadata = buildCaptainShareMetadata({ kind: 'practice' })

export default async function PracticeRsvpPage({ params }: { params: Promise<{ code: string }> }) {
  return <PracticeRsvpClient token={(await params).code} />
}
