import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import MyQuestClient from './my-quest-client'

export const metadata: Metadata = {
  title: 'Not Found',
  description: 'Page not found.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function MyQuestPage() {
  return (
    <SiteShell active="/level-up/my-quest">
      <MyQuestClient />
    </SiteShell>
  )
}
