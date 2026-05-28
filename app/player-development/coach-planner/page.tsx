import type { Metadata } from 'next'
import PlayerDevelopmentSystem from '../_components/player-development-system'

export const metadata: Metadata = {
  title: 'Coach Planner | TenAceIQ Player Development',
  description:
    'Printable TenAceIQ coach planner pages for the Relentless Competitor tennis development path.',
}

export default function CoachPlannerPage() {
  return <PlayerDevelopmentSystem focus="coach" />
}
