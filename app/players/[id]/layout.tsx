import type { Metadata } from 'next'
import { getPlayerMetadataById, getPlayerSharePreview } from '@/lib/route-metadata'
import { PlayerProfilePreviewProvider } from './player-profile-preview-context'

export const revalidate = 86400

// Generate player pages on first request, then serve them from ISR instead of
// invoking a function again for every crawler or repeat visit.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return getPlayerMetadataById(String(id))
}

export default async function PlayerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const preview = await getPlayerSharePreview(String(id))
  return (
    <PlayerProfilePreviewProvider preview={{
      name: preview.primary,
      location: preview.secondary === 'TenAceIQ player intelligence' ? null : preview.secondary,
    }}>
      {children}
    </PlayerProfilePreviewProvider>
  )
}
