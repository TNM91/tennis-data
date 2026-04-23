'use client'

import { type TiqIndividualLeagueResultRecord } from '@/lib/tiq-individual-results-service'

export type TiqIndividualLeagueSummary = {
  leagueId: string
  resultCount: number
  latestResult: TiqIndividualLeagueResultRecord | null
  leaderName: string
  leaderRecord: string
  leaderRecentForm: string
}

export function buildTiqIndividualLeagueSummaries(
  results: TiqIndividualLeagueResultRecord[],
): Map<string, TiqIndividualLeagueSummary> {
  const grouped = new Map<string, TiqIndividualLeagueResultRecord[]>()

  for (const result of results) {
    const existing = grouped.get(result.leagueId) ?? []
    existing.push(result)
    grouped.set(result.leagueId, existing)
  }

  const summaries = new Map<string, TiqIndividualLeagueSummary>()

  for (const [leagueId, leagueResults] of grouped.entries()) {
    const sorted = [...leagueResults].sort((left, right) => {
      const rightTime = new Date(right.resultDate || right.createdAt).getTime()
      const leftTime = new Date(left.resultDate || left.createdAt).getTime()
      return rightTime - leftTime
    })

    const records = new Map<string, { wins: number; losses: number; form: Array<'W' | 'L'> }>()

    for (const result of sorted) {
      const playerA = result.playerAName
      const playerB = result.playerBName
      const winner = result.winnerPlayerName
      const loser = winner === playerA ? playerB : playerA

      if (!records.has(playerA)) records.set(playerA, { wins: 0, losses: 0, form: [] })
      if (!records.has(playerB)) records.set(playerB, { wins: 0, losses: 0, form: [] })

      records.get(winner)!.wins += 1
      records.get(winner)!.form.push('W')
      records.get(loser)!.losses += 1
      records.get(loser)!.form.push('L')
    }

    const leader = [...records.entries()]
      .sort((left, right) => {
        if (right[1].wins !== left[1].wins) return right[1].wins - left[1].wins
        if (left[1].losses !== right[1].losses) return left[1].losses - right[1].losses
        return left[0].localeCompare(right[0])
      })[0]

    summaries.set(leagueId, {
      leagueId,
      resultCount: sorted.length,
      latestResult: sorted[0] || null,
      leaderName: leader?.[0] || '',
      leaderRecord: leader ? `${leader[1].wins}-${leader[1].losses}` : '0-0',
      leaderRecentForm: leader ? leader[1].form.slice(0, 5).join('') : '',
    })
  }

  return summaries
}
