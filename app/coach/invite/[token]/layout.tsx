import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildShareCardImageUrl } from '@/lib/share-card'
import { getCoachInviteSharePreview } from '@/lib/private-share-previews'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const preview = await getCoachInviteSharePreview(token)
  const title = `${preview?.playerName || 'Player'} coach connection`
  const description = `Open this secure TenAceIQ setup link to connect the player and coach${preview?.levelLabel ? ` · ${preview.levelLabel}` : ''}.`
  return {
    ...buildRouteMetadata({
      title,
      description,
      path: `/coach/invite/${encodeURIComponent(token)}`,
      image: buildShareCardImageUrl({ kind: 'development', title, subtitle: preview?.levelLabel || 'Coach connection', detail: 'Player setup · Coach handoff · TenAceIQ' }),
    }),
    robots: { index: false, follow: false },
  }
}

export default function CoachInviteLayout({ children }: { children: ReactNode }) {
  return children
}
