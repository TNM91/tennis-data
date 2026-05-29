import type { Metadata } from 'next'
import PreviewHomepage from '@/app/components/preview-homepage'

export const metadata: Metadata = {
  title: 'Homepage Preview',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PreviewHomePageRoute() {
  return <PreviewHomepage />
}
