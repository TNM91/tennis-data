import type { Metadata } from 'next'
import { AuthProvider } from '@/app/components/auth-provider'
import SeasonAvailabilityClient from './season-availability-client'

export const metadata: Metadata = { title: 'Plan your tennis season', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function SeasonAvailabilityPage() {
  return <AuthProvider><SeasonAvailabilityClient /></AuthProvider>
}
