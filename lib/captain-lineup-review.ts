export type CaptainLineupReview = {
  team: string
  opponent: string
  date: string
  courts: Array<{ label: string; players: string[] }>
}

export function buildCaptainLineupReviewText(lineup: CaptainLineupReview) {
  return [
    'Draft lineup — co-captain review',
    `${lineup.team} vs ${lineup.opponent}`,
    lineup.date,
    '',
    ...lineup.courts.map((court) => `${court.label}: ${court.players.map((name) => name.trim() || 'Open spot').join(' / ')}`),
    '',
    'Please review the courts and pairings and let me know what you would change. Player availability is still subject to confirmation.',
  ].join('\n')
}

export async function shareCaptainLineupReview(text: string, browser: Pick<Navigator, 'share' | 'clipboard'>) {
  if (typeof browser.share === 'function') {
    await browser.share({ title: 'Lineup for co-captain review', text })
    return 'shared' as const
  }
  if (!browser.clipboard?.writeText) throw new Error('Copy is unavailable. Select and copy the lineup below.')
  await browser.clipboard.writeText(text)
  return 'copied' as const
}
