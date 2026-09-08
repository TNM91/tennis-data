import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCaptainMatchWeekView } from '../use-captain-match-week-draft'

const weeklyBrief = readFileSync(join(process.cwd(), 'app/captain/weekly-brief/page.tsx'), 'utf8')
const teamBrief = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')
const matchupSheet = readFileSync(join(process.cwd(), 'app/captain/matchup-sheet/page.tsx'), 'utf8')
const recordResult = readFileSync(join(process.cwd(), 'app/captain/record-result/page.tsx'), 'utf8')
const seasonDashboard = readFileSync(join(process.cwd(), 'app/captain/season-dashboard/page.tsx'), 'utf8')
const draftRoute = readFileSync(join(process.cwd(), 'app/api/captain/lineup-drafts/route.ts'), 'utf8')
const readinessRoute = readFileSync(join(process.cwd(), 'app/api/captain/team-availability-summary/route.ts'), 'utf8')

describe('shared captain Match Week views', () => {
  it('normalizes cloud courts and logistics for every read-only captain view', () => {
    const view = buildCaptainMatchWeekView({
      competitionLayer: 'usta',
      teamName: 'TiQ Team',
      leagueName: 'Adult 18+',
      flight: '4.0',
      matchDate: '2026-09-14',
      opponentTeam: 'Rivals',
      selectedMatchId: 'match-1',
      matchFormat: 'tri_level',
      scenarioId: '',
      scenarioName: '',
      notes: '',
      teamSlots: [{
        id: 'd1',
        label: '4.0 Doubles',
        slotType: 'doubles',
        players: [
          { playerId: 'p1', playerName: 'Alex Ace' },
          { playerId: 'p2', playerName: 'Pat Volley' },
        ],
      }],
      opponentSlots: [],
      manualRosterEntries: [],
      matchDetails: {
        location: 'Forest Lake',
        directions: 'Courts 5–7',
        arrivalTime: '5:30 PM',
        notes: 'Bring balls',
      },
      matchWeekUpdatedAt: '2026-09-08T18:00:00.000Z',
    })

    expect(view.courts).toEqual([{
      id: 'd1',
      label: '4.0 Doubles',
      slotType: 'doubles',
      players: ['Alex Ace', 'Pat Volley'],
    }])
    expect(view.details.location).toBe('Forest Lake')
    expect(view.details.arrivalTime).toBe('5:30 PM')
  })

  it('connects both briefs and both scorecard outputs to the shared loader', () => {
    for (const source of [weeklyBrief, teamBrief, matchupSheet, recordResult]) {
      expect(source).toContain('useCaptainMatchWeekDraft')
    }
    expect(weeklyBrief).toContain("'Match Week synced'")
    expect(teamBrief).toContain("'Match Week synced'")
    expect(matchupSheet).toContain('matchWeek?.courts.map')
    expect(recordResult).toContain("'Match Week'")
  })

  it('finds existing drafts when an older link does not include a competition layer', () => {
    expect(draftRoute).toContain("['', 'usta', 'tiq']")
    expect(draftRoute).toContain("draftQuery.in('scope_key', scopeKeys)")
  })

  it('uses the same live replies and captain confirmations across captain views', () => {
    for (const source of [weeklyBrief, teamBrief, seasonDashboard]) {
      expect(source).toContain('useCaptainMatchWeekReadiness')
    }
    expect(readinessRoute).toContain("service.from('captain_lineup_drafts')")
    expect(readinessRoute).toContain("selection: draftSelection ? 'draft'")
  })
})
