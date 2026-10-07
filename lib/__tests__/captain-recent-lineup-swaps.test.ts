import { describe, expect, it } from 'vitest'
import { resolveCurrentRecentLineupSwap, suggestRecentLineupSwaps, type RecentSwapGuards } from '../captain-recent-lineup-swaps'
import type { CaptainLineupSlot } from '../captain-lineup-format'
import type { OpponentScoutCourt, OpponentSeasonScout } from '../captain-opponent-season-scout'

const slots: CaptainLineupSlot[] = [0, 1].map((index) => ({ id: `s${index}`, label: `Singles ${index + 1}`, slotType: 'singles', players: [{ playerId: `u${index}`, playerName: `Our ${index}` }] }))
function scout(count = 3): OpponentSeasonScout {
  return { ready: true, lines: [], fixtures: Array.from({ length: count }, (_, week) => ({ key: `w${week}`, date: `2026-09-${String(20 - week).padStart(2, '0')}`, opponent: 'Other team', wins: 2, losses: 0, unknown: 0, expectedCourts: 2,
    courts: [0, 1].map((index): OpponentScoutCourt => ({ key: `s${index}`, label: `Singles ${index + 1}`, slotIndex: index, slotType: 'singles', playerIds: [`o${index}-${week}`], playerNames: [`Opponent ${index}`], result: 'W', score: '6-4 6-3', scoreOriented: true, gamesFor: 12, gamesAgainst: 7, defaulted: false, needsReview: false })) })) }
}
const guards: RecentSwapGuards = { lockedSlotIds: new Set(), lockedPlayerIds: new Set(), excludedSlotIds: new Set(), eligible: () => true }
const project = (team: CaptainLineupSlot, opponent: CaptainLineupSlot) => {
  const first = opponent.players[0].playerId.startsWith('o0')
  return team.players[0].playerId === 'u0' ? first ? 0.2 : 0.6 : first ? 0.55 : 0.8
}
const suggest = (source = scout(), draft = slots, checks = guards) => suggestRecentLineupSwaps(source, draft, project, checks)

describe('recent-lineup court swap suggestions', () => {
  it('shows both court tradeoffs on the same weeks without changing the draft', () => {
    const source = scout()
    const before = JSON.stringify({ source, slots })
    const result = suggest(source)[0]
    expect(result).toMatchObject({ sourceId: 's0', targetId: 's1', improvedWeeks: 3, beforeMean: 1, afterMean: 1.15 })
    expect(result.courts[0].before).toBeCloseTo(0.2)
    expect(result.courts[0].after).toBeCloseTo(0.55)
    expect(result.courts[1].before).toBeCloseTo(0.8)
    expect(result.courts[1].after).toBeCloseTo(0.6)
    expect(result.weeks.map((week) => week.key)).toEqual(['w0', 'w1', 'w2'])
    expect(JSON.stringify({ source, slots })).toBe(before)
  })
  it.each([
    { lockedSlotIds: new Set(['s0']) }, { lockedPlayerIds: new Set(['u1']) }, { excludedSlotIds: new Set(['s1']) },
    { eligible: (from: CaptainLineupSlot, to: CaptainLineupSlot) => !(from.id === 's1' && to.id === 's0') },
  ])('excludes a locked, defaulted, or ineligible move', (check) => {
    expect(suggest(scout(), slots, { ...guards, ...check })).toEqual([])
  })
  it('requires improvement in at least two weeks and rejects a worse week despite a higher average', () => {
    expect(suggest(scout(1))).toEqual([])
    const badWeek = (team: CaptainLineupSlot, opponent: CaptainLineupSlot) => opponent.players[0].playerId.endsWith('-2') && team.players[0].playerId === 'u1' && opponent.players[0].playerId.startsWith('o0') ? 0.05 : project(team, opponent)
    expect(suggestRecentLineupSwaps(scout(), slots, badWeek, guards)).toEqual([])
  })
  it('does not reward a swap that drops a baseline week from the comparison', () => {
    const missingAfter = (team: CaptainLineupSlot, opponent: CaptainLineupSlot) => team.players[0].playerId === 'u1' && opponent.players[0].playerId === 'o0-2' ? null : project(team, opponent)
    expect(suggestRecentLineupSwaps(scout(), slots, missingAfter, guards)).toEqual([])
  })
  it('uses only the common scored courts and rejects defaults and conflicting evidence', () => {
    const source = scout()
    source.fixtures[0].courts[0].needsReview = true
    expect(suggest(source)[0].weeks.map((week) => week.key)).toEqual(['w1', 'w2'])
    source.fixtures[1].courts[0].defaulted = true
    expect(suggest(source)).toEqual([])
  })
  it('rejects mixed formats, manual names, repeated players, duplicate courts, and missing ratings', () => {
    expect(suggest(scout(), [slots[0], { ...slots[1], slotType: 'doubles' }])).toEqual([])
    expect(suggest(scout(), [slots[0], { ...slots[1], players: [{ playerId: '', playerName: 'Manual' }] }])).toEqual([])
    expect(suggest(scout(), [slots[0], { ...slots[1], players: slots[0].players }])).toEqual([])
    expect(suggest(scout(), [slots[0], { ...slots[1], id: slots[0].id }])).toEqual([])
    expect(suggestRecentLineupSwaps(scout(), slots, () => null, guards)).toEqual([])
    expect(suggest({ ...scout(), ready: false })).toEqual([])
  })
  it('keeps doubles partners together in each forecast and requires eligibility for both new courts', () => {
    const doubles = slots.map((slot, index): CaptainLineupSlot => ({ ...slot, slotType: 'doubles', players: [...slot.players, { playerId: `partner${index}`, playerName: 'Partner' }] }))
    const source = scout()
    source.fixtures.forEach((fixture) => fixture.courts.forEach((court) => { court.slotType = 'doubles'; court.playerIds.push(`partner-${court.playerIds[0]}`); court.playerNames.push('Their partner') }))
    const seen: string[][] = []
    const pairs = (team: CaptainLineupSlot, opponent: CaptainLineupSlot) => { seen.push(team.players.map((player) => player.playerId)); return project(team, opponent) }
    expect(suggestRecentLineupSwaps(source, doubles, pairs, guards)).toHaveLength(1)
    expect(seen.every((ids) => ids.join('|') === 'u0|partner0' || ids.join('|') === 'u1|partner1')).toBe(true)
    expect(suggestRecentLineupSwaps(source, doubles, pairs, { ...guards, lockedPlayerIds: new Set(['partner0']) })).toEqual([])
    expect(suggestRecentLineupSwaps(source, doubles, pairs, { ...guards, eligible: (from) => from.id !== 's0' })).toEqual([])
  })
  it('rejects applying an old suggestion after edits, new locks, or changed rating evidence', () => {
    const current = suggest()
    expect(resolveCurrentRecentLineupSwap(current[0], slots, current)).toEqual(current[0])
    expect(resolveCurrentRecentLineupSwap(current[0], [{ ...slots[0], players: [{ playerId: 'other', playerName: 'New' }] }, slots[1]], current)).toBeNull()
    expect(resolveCurrentRecentLineupSwap(current[0], slots, [])).toBeNull()
    expect(resolveCurrentRecentLineupSwap(current[0], slots, [{ ...current[0], weeks: current[0].weeks.map((week) => ({ ...week, after: [0.7, 0.8] })) }])).toBeNull()
  })
  it('limits suggestions to the top three and the four latest recorded weeks', () => {
    const draft = Array.from({ length: 5 }, (_, index) => ({ ...slots[0], id: `s${index}`, players: [{ playerId: `u${index}`, playerName: `Our ${index}` }] }))
    const source = scout(5)
    source.fixtures.forEach((fixture) => { fixture.courts = draft.map((slot, index) => ({ ...fixture.courts[0], key: slot.id, slotIndex: index, playerIds: [`o${index}`] })) })
    const result = suggestRecentLineupSwaps(source, draft, (team, _opponent, index) => team.players[0].playerId === `u${index}` ? 0.3 : 0.6, guards)
    expect(result).toHaveLength(3)
    expect(result.every((swap) => swap.weeks.length === 4)).toBe(true)
  })
})
