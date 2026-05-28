import type { Metadata } from 'next'
import PlayerDevelopmentSystem from '../_components/player-development-system'

export const metadata: Metadata = {
  title: 'Player Workbook | TenAceIQ Player Development',
  description:
    'Printable TenAceIQ player workbook pages for the Relentless Competitor development identity.',
}

export default function PlayerWorkbookPage() {
  return <PlayerDevelopmentSystem focus="workbook" />
}
