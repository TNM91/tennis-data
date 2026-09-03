import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

export type PlayerTrophyBadge = {
  key: string
  label: string
  detail: string
  progressLabel: string
  earned: boolean
  icon: TiqFeatureIconName
}

type PlayerTrophyBadgeInput = {
  verifiedHonors: number
  reviewedMatches: number
  longestWinStreak: number
  firstServeProgress?: number
}

export function buildPlayerTrophyBadges(input: PlayerTrophyBadgeInput): PlayerTrophyBadge[] {
  const honors = Math.max(0, Math.floor(input.verifiedHonors || 0))
  const matches = Math.max(0, Math.floor(input.reviewedMatches || 0))
  const streak = Math.max(0, Math.floor(input.longestWinStreak || 0))
  const firstServeProgress = Math.min(3, Math.max(0, Math.floor(input.firstServeProgress || 0)))

  return [
    badge('first-serve', 'First serve', firstServeProgress >= 3, `${firstServeProgress}/3 steps`, firstServeProgress >= 3 ? 'Your Player ID, first focus, and first court proof are connected.' : 'Connect your player, choose one focus, and finish a first court rep.', 'myLab'),
    badge('verified-honor', 'Podium proof', honors > 0, `${honors} verified honor${honors === 1 ? '' : 's'}`, honors ? 'Earned from a verified TIQ result.' : 'Earn a verified tournament or league honor.', 'competeTennis'),
    badge('match-builder', 'Match builder', matches >= 10, `${Math.min(matches, 10)}/10 matches`, matches >= 10 ? 'Ten reviewed results are on your record.' : 'Review ten scored matches to earn it.', 'playerRatings'),
    badge('streak-keeper', 'Streak keeper', streak >= 3, `${Math.min(streak, 3)}/3 wins`, streak >= 3 ? 'Three straight recorded wins.' : 'Build a three-match win streak.', 'matchPrep'),
    badge('court-regular', 'Court regular', matches >= 25, `${Math.min(matches, 25)}/25 matches`, matches >= 25 ? 'Twenty-five reviewed matches completed.' : 'Keep building your verified match history.', 'reliabilityIndex'),
  ]
}

function badge(
  key: string,
  label: string,
  earned: boolean,
  progressLabel: string,
  detail: string,
  icon: TiqFeatureIconName,
): PlayerTrophyBadge {
  return { key, label, detail, progressLabel, earned, icon }
}
