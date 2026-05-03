import type { Metadata } from 'next'
import { getPlayerMetadataById } from '@/lib/route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return getPlayerMetadataById(String(id))
}

export default function PlayerDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
