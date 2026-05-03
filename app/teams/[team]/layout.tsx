import type { Metadata } from 'next'
import { getTeamMetadataByName } from '@/lib/route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>
}): Promise<Metadata> {
  const { team } = await params
  return getTeamMetadataByName(decodeURIComponent(String(team)))
}

export default function TeamDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
