import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import TiqTacticalStudioGate from '@/components/tactical/TiqTacticalStudioGate'

export const metadata: Metadata = {
  title: 'TIQ Tactical Studio | TenAceIQ',
  description: 'Build TenAceIQ tactical tennis scenarios with a locked branded court and reusable drill overlays.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function TacticsPage() {
  return (
    <SiteShell active="captain">
      <TiqTacticalStudioGate />
    </SiteShell>
  )
}
