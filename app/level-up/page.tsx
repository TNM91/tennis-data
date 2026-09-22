import { cookies } from 'next/headers'
import LevelUpPageContent from './level-up-page-content'
import { getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { isPlayerStyleSlug, PLAYER_STYLE_COOKIE } from '@/lib/player-identity-selection'

export const metadata = {
  title: {
    absolute: 'Level Up | TenAceIQ',
  },
  description: 'Choose what to improve today, start a tennis drill, use the timer, and save a quick Level Up check-in.',
}

export default async function LevelUpPage() {
  const savedStyle = (await cookies()).get(PLAYER_STYLE_COOKIE)?.value
  const savedStyleSlug = isPlayerStyleSlug(savedStyle) ? savedStyle : null
  const identity = getPlayerDevelopmentIdentity(savedStyleSlug ?? 'relentless-competitor-4-0')
  return <LevelUpPageContent identity={identity} initialSavedStyleSlug={savedStyleSlug} />
}
