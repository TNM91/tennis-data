import { describe, expect, it } from 'vitest'
import {
  captainLineupDraftMatchesScope,
  getCaptainLineupDraftStorageKey,
  hasCaptainLineupDraftContent,
  type CaptainLineupBuilderDraft,
} from '@/lib/captain-lineup-handoff'

function draft(overrides: Partial<CaptainLineupBuilderDraft> = {}): CaptainLineupBuilderDraft {
  return {
    competitionLayer: 'usta',
    leagueName: '2026 STL Tri-Level',
    flight: 'Men 3.5/4.0/4.5',
    teamName: 'SuperSmash Bros',
    opponentTeam: 'Gontarz',
    matchDate: '2026-09-14',
    selectedMatchId: 'match-1',
    matchFormat: 'tri_level',
    scenarioId: '',
    scenarioName: '',
    notes: '',
    teamSlots: [],
    opponentSlots: [],
    manualRosterEntries: [],
    ...overrides,
  }
}

describe('captain lineup draft scope', () => {
  it('keeps drafts for different teams and matches in separate local keys', () => {
    const first = draft()
    const otherTeam = draft({ teamName: 'Other Guys' })
    const otherMatch = draft({ matchDate: '2026-09-21' })

    expect(getCaptainLineupDraftStorageKey('captain-1', first)).not.toBe(
      getCaptainLineupDraftStorageKey('captain-1', otherTeam),
    )
    expect(getCaptainLineupDraftStorageKey('captain-1', first)).not.toBe(
      getCaptainLineupDraftStorageKey('captain-1', otherMatch),
    )
  })

  it('restores an explicit route only from its matching draft', () => {
    const stored = draft()
    expect(captainLineupDraftMatchesScope(stored, {
      teamName: ' supersmash bros ',
      matchDate: '2026-09-14',
      opponentTeam: 'GONTARZ',
    })).toBe(true)
    expect(captainLineupDraftMatchesScope(stored, { teamName: 'Other Guys' })).toBe(false)
  })

  it('recognizes assignments, notes, opponent work, and manual roster entries as draft content', () => {
    expect(hasCaptainLineupDraftContent(draft())).toBe(false)
    expect(hasCaptainLineupDraftContent(draft({ notes: 'Protect court two' }))).toBe(true)
    expect(hasCaptainLineupDraftContent(draft({
      teamSlots: [{ players: [{ playerId: 'p1', playerName: 'Nathan Meinert' }] }],
    }))).toBe(true)
    expect(hasCaptainLineupDraftContent(draft({
      opponentSlots: [{ players: [{ playerName: 'Opponent One' }] }],
    }))).toBe(true)
    expect(hasCaptainLineupDraftContent(draft({
      manualRosterEntries: [{ name: 'New Player', teamName: '', leagueName: '', flight: '' }],
    }))).toBe(true)
  })
})
