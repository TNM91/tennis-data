import type { Metadata } from 'next'
import { formatLeagueWeeklyShareDate, getLeagueWeeklySharePreview } from '@/lib/league-weekly-share'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const preview = await getLeagueWeeklySharePreview(token)
  const leagueName = preview?.leagueName || 'TIQ League'
  const playDate = formatLeagueWeeklyShareDate(preview?.playOn || '')
  const title = `Are you in? · ${leagueName}`
  const description = `${playDate}${preview?.facility ? ` at ${preview.facility}` : ''}. Reply in or out and get this week's court assignment.`

  return {
    title: { absolute: `${title} | TenAceIQ` },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: 'TenAceIQ',
      title,
      description,
      images: [{ url: `/league-week/${encodeURIComponent(token)}/opengraph-image`, width: 1200, height: 630, alt: `${leagueName} weekly RSVP` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [`/league-week/${encodeURIComponent(token)}/opengraph-image`] },
  }
}

export default function WeeklyLeagueLayout({ children }: { children: React.ReactNode }) {
  return children
}
