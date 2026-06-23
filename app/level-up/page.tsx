import LevelUpPageContent from './level-up-page-content'
import { getPlayerDevelopmentIdentity } from '@/lib/player-development'

export const metadata = {
  title: {
    absolute: 'Level Up | TenAceIQ',
  },
  description: 'Choose what to improve today, start a tennis drill, use the timer, and save a quick Level Up check-in.',
}

export default function LevelUpPage() {
  const identity = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
  return <LevelUpPageContent identity={identity} />
}
