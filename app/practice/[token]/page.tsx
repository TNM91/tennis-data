import type { Metadata } from 'next'
import PracticeRsvpClient from '@/app/pr/[code]/practice-rsvp-client'

export const metadata: Metadata = {
  title: 'Practice RSVP',
  robots: { index: false, follow: false },
}

export default async function PracticeRsvpFallbackPage({ params }: { params: Promise<{ token: string }> }) {
  return <PracticeRsvpClient token={(await params).token} />
}
