import type { Metadata } from 'next'
import { getLeagueMetadataByName } from '@/lib/route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>
}): Promise<Metadata> {
  const { league } = await params
  return getLeagueMetadataByName(decodeURIComponent(String(league)))
}

export default function LeagueDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
