import { swapCaptainLineupCourtAssignments, type CaptainLineupSlot } from './captain-lineup-format'
import { compareRecentOpponentLineups } from './captain-recent-lineup-comparison'
import type { OpponentSeasonScout } from './captain-opponent-season-scout'

type Project = Parameters<typeof compareRecentOpponentLineups>[2]
export type RecentSwapGuards = {
  lockedSlotIds: ReadonlySet<string>
  lockedPlayerIds: ReadonlySet<string>
  excludedSlotIds: ReadonlySet<string>
  eligible: (from: CaptainLineupSlot, to: CaptainLineupSlot) => boolean
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
  const unlocked = (slot: CaptainLineupSlot) => !guards.lockedSlotIds.has(slot.id) && !guards.excludedSlotIds.has(slot.id)
    && slot.players.every((player) => player.playerId && !guards.lockedPlayerIds.has(player.playerId))

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
      weeks.push({ key: baseline.courts[first].weeks[week].key, date: baseline.courts[first].weeks[week].date,
        before: beforeValues, after: afterValues,
        gain: afterValues[0] + afterValues[1] - beforeValues[0] - beforeValues[1] })
    }
    // Compare the same complete two-court samples. Do not reward dropped evidence,
    // a single week's result, or a gain that makes another assessed week worse.
    if (lostCoverage || weeks.length < 2 || weeks.some((week) => week.gain < -0.000001)) continue
    const improvedWeeks = weeks.filter((week) => week.gain >= 0.01).length
    if (improvedWeeks < 2) continue
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    const beforeMean = mean(weeks.map((week) => week.before[0] + week.before[1]))
    const afterMean = mean(weeks.map((week) => week.after[0] + week.after[1]))
    if (afterMean - beforeMean < 0.01) continue
    suggestions.push({ id: JSON.stringify([source.id, target.id]), signature,
      sourceId: source.id, targetId: target.id, labels: [source.label, target.label],
      names: [source.players.map((player) => player.playerName), target.players.map((player) => player.playerName)],
      weeks, improvedWeeks, beforeMean, afterMean,
      courts: [first, second].map((index, seat) => ({ label: slots[index].label,
        before: mean(weeks.map((week) => week.before[seat])), after: mean(weeks.map((week) => week.after[seat])) })),
    })
  }
  return suggestions.sort((a, b) => (b.afterMean - b.beforeMean) - (a.afterMean - a.beforeMean) || b.weeks.length - a.weeks.length || a.id.localeCompare(b.id)).slice(0, 3)
}

export type RecentLineupSwap = {
  id: string; signature: string; sourceId: string; targetId: string; labels: string[]; names: string[][]
  weeks: Array<{ key: string; date: string; before: number[]; after: number[]; gain: number }>
  improvedWeeks: number; beforeMean: number; afterMean: number
  courts: Array<{ label: string; before: number; after: number }>
}

export function resolveCurrentRecentLineupSwap(suggestion: RecentLineupSwap, slots: CaptainLineupSlot[], currentSuggestions: RecentLineupSwap[]) {
  if (suggestion.signature !== recentLineupDraftSignature(slots)) return null
  return currentSuggestions.find((current) => current.id === suggestion.id && current.signature === suggestion.signature
    && JSON.stringify(current.weeks) === JSON.stringify(suggestion.weeks)) || null
}
