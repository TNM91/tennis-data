import type { Metadata } from 'next'
import PlayerDevelopmentSystem from './_components/player-development-system'

export const metadata: Metadata = {
  title: 'Player Development System | TenAceIQ',
  description:
    'A premium TenAceIQ printable workbook and coach planner concept for competitive tennis player development.',
}

export default function PlayerDevelopmentPage() {
  return <PlayerDevelopmentSystem />
}
