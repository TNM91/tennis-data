'use client'

import { type TiqIndividualSuggestionRecord } from '@/lib/tiq-individual-suggestions-service'

export type TiqIndividualSuggestionSummary = {
  leagueId: string
  openCount: number
  completedCount: number
  latestOpenTitle: string
  claimedOpenCount: number
  latestClaimedByLabel: string
}

export function buildTiqIndividualSuggestionSummaries(
  suggestions: TiqIndividualSuggestionRecord[],
): Map<string, TiqIndividualSuggestionSummary> {
  const grouped = new Map<string, TiqIndividualSuggestionRecord[]>()

  suggestions.forEach((suggestion) => {
    const existing = grouped.get(suggestion.leagueId) ?? []
    existing.push(suggestion)
    grouped.set(suggestion.leagueId, existing)
  })

  const summaries = new Map<string, TiqIndividualSuggestionSummary>()

  grouped.forEach((leagueSuggestions, leagueId) => {
    const sorted = [...leagueSuggestions].sort(
      (left, right) =>
        new Date(right.updatedAt || right.createdAt).getTime() -
        new Date(left.updatedAt || left.createdAt).getTime(),
    )
    const openSuggestions = sorted.filter((item) => item.status === 'open')
    const completedSuggestions = sorted.filter((item) => item.status === 'completed')

    summaries.set(leagueId, {
      leagueId,
      openCount: openSuggestions.length,
      completedCount: completedSuggestions.length,
      latestOpenTitle: openSuggestions[0]?.title || '',
      claimedOpenCount: openSuggestions.filter((item) => item.claimedByUserId).length,
      latestClaimedByLabel: openSuggestions.find((item) => item.claimedByLabel)?.claimedByLabel || '',
    })
  })

  return summaries
}
