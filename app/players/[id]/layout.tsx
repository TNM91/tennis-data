import type { Metadata } from 'next'
import { getPlayerMetadataById } from '@/lib/route-metadata'
import { notFound } from 'next/navigation'
import { getPublicPlayerProfile } from '@/lib/public-player-evidence-server'
import { hasDiscoverablePlayerEvidence } from '@/lib/public-player-evidence'
import { PublicPlayerSnapshot } from '@/app/components/public-player-evidence'
import { PublicPlayerContentProvider } from '@/app/components/public-player-content-context'

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
  const profile = await getPublicPlayerProfile(String(id))
  if (!profile) return { robots: { index: false, follow: true } }
  const metadata = await getPlayerMetadataById(String(id))
  return hasDiscoverablePlayerEvidence(profile) ? metadata : { ...metadata, robots: { index: false, follow: true } }
}

export default async function PlayerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getPublicPlayerProfile(id)
  if (!profile) notFound()
  return (
    <PublicPlayerContentProvider profileId={id} profileContent={<PublicPlayerSnapshot evidence={profile} />}>
      {children}
    </PublicPlayerContentProvider>
  )
}
