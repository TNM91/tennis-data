import { swapCaptainLineupCourtAssignments, type CaptainLineupSlot } from './captain-lineup-format'
import { compareRecentOpponentLineups } from './captain-recent-lineup-comparison'
import type { OpponentSeasonScout } from './captain-opponent-season-scout'
import { applyKnownCourtDefaults, calculateTeamMatchWinProbability, type CaptainKnownCourtDefault } from './captain-lineup-defaults'

type Project = Parameters<typeof compareRecentOpponentLineups>[2]
export type RecentSwapGuards = {
  lockedSlotIds: ReadonlySet<string>
  lockedPlayerIds: ReadonlySet<string>
  excludedSlotIds: ReadonlySet<string>
  eligible: (from: CaptainLineupSlot, to: CaptainLineupSlot) => boolean
  teamScoring?: { supported: boolean; expectedCourts: number; knownDefaults?: CaptainKnownCourtDefault[] }
}

export function recentLineupDraftSignature(slots: CaptainLineupSlot[]) {
  return JSON.stringify(slots.map(({ id, label, slotType, ratingLevel, players }) => ({ id, label, slotType, ratingLevel, players })))
}

export function suggestRecentLineupSwaps(scout: OpponentSeasonScout, slots: CaptainLineupSlot[], project: Project, guards: RecentSwapGuards) {
  const assignedIds = slots.flatMap((slot) => slot.players.map((player) => player.playerId).filter(Boolean))
  if (!scout.ready || new Set(assignedIds).size !== assignedIds.length || new Set(slots.map((slot) => slot.id)).size !== slots.length) return []
  const baseline = compareRecentOpponentLineups(scout, slots, project)
  const suggestions: RecentLineupSwap[] = []
  const signature = recentLineupDraftSignature(slots)
  const teamScoring = guards.teamScoring || { supported: true, expectedCourts: slots.length }
  const knownDefaults = teamScoring.knownDefaults || []
  const defaultLabels = new Set(knownDefaults.map((item) => item.label.trim().replace(/\s+/g, ' ').toLowerCase()))
  const unlocked = (slot: CaptainLineupSlot) => !guards.lockedSlotIds.has(slot.id) && !guards.excludedSlotIds.has(slot.id)
    && !defaultLabels.has(slot.label.trim().replace(/\s+/g, ' ').toLowerCase())
    && slot.players.every((player) => player.playerId && !guards.lockedPlayerIds.has(player.playerId))
  const teamProbability = (comparison: ReturnType<typeof compareRecentOpponentLineups>, week: number) => {
    if (!teamScoring.supported || slots.length !== teamScoring.expectedCourts || !slots.length) return null
    const fixture = scout.fixtures.find((item) => item.key === comparison.courts[0].weeks[week].key)
    if (fixture?.expectedCourts !== slots.length) return null
    const adjusted = applyKnownCourtDefaults(comparison.courts.map((court) => ({ label: court.label, projection: court.weeks[week].probability })), knownDefaults)
    // The shared calculator supplies 50% for unknown courts. Require complete
    // evidence here so missing history is never silently treated as an even court.
    if (adjusted.courts.some((court) => court.projection === null)) return null
    return calculateTeamMatchWinProbability(adjusted.courts.map((court) => court.projection))
  }

  for (let first = 0; first < slots.length; first++) for (let second = first + 1; second < slots.length; second++) {
    const source = slots[first]
    const target = slots[second]
    const required = source.slotType === 'singles' ? 1 : 2
    if (source.slotType !== target.slotType || source.players.length !== required || target.players.length !== required
      || !unlocked(source) || !unlocked(target) || !guards.eligible(source, target) || !guards.eligible(target, source)) continue
    const swapped = swapCaptainLineupCourtAssignments(slots, source.id, target.id)
    if (!swapped.swapped) continue
    const candidate = compareRecentOpponentLineups(scout, swapped.slots, project)
    const weeks: RecentLineupSwap['weeks'] = []
    let lostCoverage = false
    for (let week = 0; week < baseline.fixtureCount; week++) {
      const before = [baseline.courts[first].weeks[week].probability, baseline.courts[second].weeks[week].probability]
      const after = [candidate.courts[first].weeks[week].probability, candidate.courts[second].weeks[week].probability]
      if (before.some((value) => value === null)) continue
      if (after.some((value) => value === null)) { lostCoverage = true; break }
      const beforeValues = before as number[]
      const afterValues = after as number[]
      const teamBefore = teamProbability(baseline, week)
      const teamAfter = teamProbability(candidate, week)
      if (teamBefore !== null && teamAfter === null) { lostCoverage = true; break }
      weeks.push({ key: baseline.courts[first].weeks[week].key, date: baseline.courts[first].weeks[week].date,
        before: beforeValues, after: afterValues,
        teamBefore, teamAfter,
        gain: afterValues[0] + afterValues[1] - beforeValues[0] - beforeValues[1] })
    }
    if (lostCoverage || weeks.length < 2) continue
    const teamWeeks = weeks.filter((week) => week.teamBefore !== null && week.teamAfter !== null)
    // Even one complete week can contradict a court-only recommendation. Never
    // suggest a swap that lowers the known team-match forecast in that week.
    if (teamWeeks.some((week) => week.teamAfter! - week.teamBefore! < -0.000001)) continue
    const ranking = teamWeeks.length >= 2 ? 'team-match' : 'court-wins'
    const gains = ranking === 'team-match' ? teamWeeks.map((week) => week.teamAfter! - week.teamBefore!) : weeks.map((week) => week.gain)
    if (gains.some((gain) => gain < -0.000001)) continue
    const improvedWeeks = gains.filter((gain) => gain >= 0.01).length
    if (improvedWeeks < 2) continue
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    const beforeMean = mean(weeks.map((week) => week.before[0] + week.before[1]))
    const afterMean = mean(weeks.map((week) => week.after[0] + week.after[1]))
    const teamBeforeMean = teamWeeks.length ? mean(teamWeeks.map((week) => week.teamBefore!)) : null
    const teamAfterMean = teamWeeks.length ? mean(teamWeeks.map((week) => week.teamAfter!)) : null
    const rankingGain = ranking === 'team-match' ? teamAfterMean! - teamBeforeMean! : afterMean - beforeMean
    if (rankingGain < 0.01) continue
    suggestions.push({ id: JSON.stringify([source.id, target.id]), signature,
      sourceId: source.id, targetId: target.id, labels: [source.label, target.label],
      names: [source.players.map((player) => player.playerName), target.players.map((player) => player.playerName)],
      weeks, improvedWeeks, beforeMean, afterMean,
      ranking, rankingGain, fixtureCount: baseline.fixtureCount, teamWeeks: teamWeeks.length, teamBeforeMean, teamAfterMean,
      neededWins: Math.floor(slots.length / 2) + 1, courtCount: slots.length,
      courts: [first, second].map((index, seat) => ({ label: slots[index].label,
        before: mean(weeks.map((week) => week.before[seat])), after: mean(weeks.map((week) => week.after[seat])) })),
    })
  }
  return suggestions.sort((a, b) => Number(b.ranking === 'team-match') - Number(a.ranking === 'team-match')
    || b.rankingGain - a.rankingGain || b.weeks.length - a.weeks.length || a.id.localeCompare(b.id)).slice(0, 3)
}

export type RecentLineupSwap = {
  id: string; signature: string; sourceId: string; targetId: string; labels: string[]; names: string[][]
  weeks: Array<{ key: string; date: string; before: number[]; after: number[]; gain: number; teamBefore: number | null; teamAfter: number | null }>
  improvedWeeks: number; beforeMean: number; afterMean: number
  courts: Array<{ label: string; before: number; after: number }>
  ranking: 'team-match' | 'court-wins'; rankingGain: number; fixtureCount: number; teamWeeks: number
  teamBeforeMean: number | null; teamAfterMean: number | null; neededWins: number; courtCount: number
}

export function resolveCurrentRecentLineupSwap(suggestion: RecentLineupSwap, slots: CaptainLineupSlot[], currentSuggestions: RecentLineupSwap[]) {
  if (suggestion.signature !== recentLineupDraftSignature(slots)) return null
  return currentSuggestions.find((current) => current.id === suggestion.id && current.signature === suggestion.signature
    && JSON.stringify(current.weeks) === JSON.stringify(suggestion.weeks)) || null
}
