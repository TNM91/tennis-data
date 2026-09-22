import type { Metadata } from 'next'
import { getMatchMetadataById } from '@/lib/route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return getMatchMetadataById(String(id))
}

export default function MatchDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
