import type { Metadata } from 'next'
import PracticeRsvpClient from './practice-rsvp-client'

export const metadata: Metadata = {
  title: 'Practice RSVP',
  robots: { index: false, follow: false },
}

export default async function PracticeRsvpPage({ params }: { params: Promise<{ code: string }> }) {
  return <PracticeRsvpClient token={(await params).code} />
}
