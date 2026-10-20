import { describe, expect, it } from 'vitest'
import { buildCaptainLineupSlots, fitCaptainLineupSlotsToFormat, getCaptainMatchWinProbability, swapCaptainLineupCourtAssignments } from '../captain-lineup-format'
import { buildPotentialLineupAvailabilityMessage, extractPotentialLineupPlayers } from '../captain-lineup-handoff'
import { buildLineupChanges, buildTeamRoomCourtReadiness, normalizeLineupRows, selectPrimaryTeamRoomCourtReadiness } from '../team-room-match-flow'
import { buildCaptainLockedLineupAnnouncement, buildCaptainLockedLineupId } from '../captain-lineup-confirmation'
import { sanitizeCaptainLineupReviewSlots } from '../captain-lineup-review'

describe('captain court defaults', () => {
  it('counts forfeited courts as losses in the match forecast', () => {
    expect(getCaptainMatchWinProbability([0, 0.5, 0.5])).toBe(0.25)
    expect(getCaptainMatchWinProbability([0, 0, 1])).toBe(0)
    expect(getCaptainMatchWinProbability([0, 1, 1])).toBe(1)
    expect(getCaptainMatchWinProbability([0, 0, 0])).toBe(0)
  })
  it('preserves a saved default in a fixed format and removes stale player assignments', () => {
    const slots = buildCaptainLineupSlots('Adult 18 & Over', 'Men 4.0', 'team')
    slots[1] = { ...slots[1], defaulted: true, players: [{ playerId: 'stale', playerName: 'Old Player' }] }
    const fitted = fitCaptainLineupSlotsToFormat(JSON.parse(JSON.stringify(slots)), 'Adult 18 & Over', 'Men 4.0', 'team')
    expect(fitted).toHaveLength(slots.length)
    expect(fitted[1]).toMatchObject({ defaulted: true, players: [{ playerId: '', playerName: '' }] })
    expect(fitted[0].defaulted).toBeUndefined()
  })

  it('never invites a stale player from a defaulted court and labels the availability text', () => {
    const slots = [
      { label: 'Singles 1', slotType: 'singles', players: [{ playerName: 'Alex' }] },
      { label: 'Singles 2', slotType: 'singles', defaulted: true, players: [{ playerName: 'Old Player' }] },
    ]
    expect(extractPotentialLineupPlayers(slots)).toEqual(['Alex'])
    const text = buildPotentialLineupAvailabilityMessage({ teamName: 'Aces', opponent: 'Rivals', dateText: 'Oct 25', time: '', facility: '', slotsJson: slots })
    expect(text).toContain('Singles 2: Default')
    expect(text).not.toContain('Old Player')
  })

  it('requires replies for playing courts while resolving a declared default without fictitious players', () => {
    const lineup = normalizeLineupRows([
      { label: 'Singles 1', players: ['Alex'] },
      { label: 'Singles 2', defaulted: true, players: ['Stale Player'] },
    ])
    expect(lineup[1]).toEqual({ label: 'Singles 2', defaulted: true, players: [] })
    const pending = buildTeamRoomCourtReadiness({ lineup, replies: [] })
    expect(pending.map((court) => court.status)).toEqual(['waiting', 'confirmed'])
    expect(selectPrimaryTeamRoomCourtReadiness(pending)?.label).toBe('Singles 1')
    const ready = buildTeamRoomCourtReadiness({ lineup, replies: [{ status: 'yes', names: ['Alex'] }] })
    expect(selectPrimaryTeamRoomCourtReadiness(ready)).toBeNull()
    expect(buildCaptainLockedLineupAnnouncement({ lineup })).toContain('Singles 2: Default')
    expect(sanitizeCaptainLineupReviewSlots([{ id: 's2', label: 'Singles 2', slotType: 'singles', defaulted: true, players: [{ playerName: 'Stale Player' }] }])[0])
      .toMatchObject({ defaulted: true, players: [{ playerId: '', playerName: '' }] })
  })

  it('does not interpret an empty court or truthy string as a default', () => {
    const lineup = normalizeLineupRows([{ label: 'Singles 1', defaulted: 'true', players: [] }])
    expect(lineup[0].defaulted).toBeUndefined()
    expect(buildTeamRoomCourtReadiness({ lineup, replies: [] })[0].status).toBe('needs_captain')
  })

  it('treats a default and an unfilled court as different saved versions', () => {
    const before = [{ label: 'Singles 2', players: [] }]
    const after = [{ label: 'Singles 2', players: [], defaulted: true }]
    expect(buildLineupChanges(before, after)).toEqual(['Singles 2: Open -> Default'])
    expect(buildCaptainLockedLineupId({ messageId: 'same', lineup: before }))
      .not.toBe(buildCaptainLockedLineupId({ messageId: 'same', lineup: after }))
  })

  it('requires reopening a default before swapping players onto it', () => {
    const slots = buildCaptainLineupSlots('Adult 18 & Over', 'Men 4.0', 'team')
    slots[1].defaulted = true
    expect(swapCaptainLineupCourtAssignments(slots, slots[0].id, slots[1].id).swapped).toBe(false)
    expect(slots[1].players.every((player) => !player.playerId)).toBe(true)
  })
})
