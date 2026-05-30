import type { Metadata } from 'next'
import { getTournamentMetadataById } from '@/lib/route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return getTournamentMetadataById(String(id))
}

export default function TournamentDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
