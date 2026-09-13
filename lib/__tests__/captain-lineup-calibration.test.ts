import { describe, expect, it } from 'vitest'
import {
  buildCaptainLineupCalibration,
  summarizeCaptainCalibrations,
  type CaptainPredictionSnapshot,
} from '@/lib/captain-lineup-calibration'
import type { CaptainScorecardInput } from '@/lib/captain-scorecard'

const snapshot: CaptainPredictionSnapshot = {
  id: 'snapshot-1',
  created_at: '2026-09-12T12:00:00Z',
  scenario_name: 'Best odds',
  projected_team_win_pct: 0.62,
  projected_score_for: 2,
  projected_score_against: 1,
  confidence_score: 0.72,
  confidence_tier: 'Moderate confidence',
  slots_json: [
    { label: 'Doubles 1', players: [{ playerName: 'Alex Ace' }, { playerName: 'Ben Baseline' }] },
    { label: 'Doubles 2', players: [{ playerName: 'Chris Court' }, { playerName: 'Drew Drop' }] },
    { label: 'Doubles 3', players: [{ playerName: 'Evan Edge' }, { playerName: 'Finn First' }] },
  ],
  opponent_slots_json: [
    { label: 'Doubles 1', players: [{ playerName: 'Opp One' }, { playerName: 'Opp Two' }] },
    { label: 'Doubles 2', players: [{ playerName: 'Opp Three' }, { playerName: 'Opp Four' }] },
    { label: 'Doubles 3', players: [{ playerName: 'Opp Five' }, { playerName: 'Opp Six' }] },
  ],
  line_projections_json: [
    { label: 'Doubles 1', projection: 0.7 },
    { label: 'Doubles 2', projection: 0.4 },
    { label: 'Doubles 3', projection: 0.65 },
  ],
}

const result: CaptainScorecardInput = {
  teamName: 'TenAce Aces',
  opponentTeam: 'Baseline Club',
  matchDate: '2026-09-12',
  lines: [
    { courtNumber: 1, label: 'Doubles 1', matchType: 'doubles', teamPlayers: ['Alex Ace', 'Ben Baseline'], opponentPlayers: ['Opp One', 'Opp Two'], outcome: 'team', score: '6-3, 6-4' },
    { courtNumber: 2, label: 'Doubles 2', matchType: 'doubles', teamPlayers: ['Chris Court', 'Late Sub'], opponentPlayers: ['Opp Three', 'Opp Four'], outcome: 'opponent', score: '4-6, 3-6' },
    { courtNumber: 3, label: 'Doubles 3', matchType: 'doubles', teamPlayers: ['Evan Edge', 'Finn First'], opponentPlayers: ['Stack One', 'Stack Two'], outcome: 'opponent', score: '6-7, 6-4, 0-1' },
  ],
}

describe('captain lineup calibration', () => {
  it('reconciles the saved prediction with the played lineup and verified courts', () => {
    const calibration = buildCaptainLineupCalibration(snapshot, result)

    expect(calibration.actualOutcome).toBe('lost')
    expect(calibration.teamPredictionCorrect).toBe(false)
    expect(calibration.exactScoreCorrect).toBe(false)
    expect(calibration.courtPredictionAccuracy).toBe(0.667)
    expect(calibration.brierScore).toBe(0.224)
    expect(calibration.lineupAdherence).toBe(0.833)
    expect(calibration.opponentPlacementAccuracy).toBe(0.667)
    expect(calibration.courts.map((court) => court.predictionCorrect)).toEqual([true, true, false])
    expect(calibration.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ratings', direction: 'learn' }),
      expect.objectContaining({ id: 'pair-fit', direction: 'watch' }),
    ]))
  })

  it('summarizes match, court, probability, and lineup-execution evidence', () => {
    const first = buildCaptainLineupCalibration(snapshot, result)
    const second = { ...first, teamPredictionCorrect: true, exactScoreCorrect: true, brierScore: 0.1, lineupAdherence: 1 }
    expect(summarizeCaptainCalibrations([first, second])).toEqual({
      matches: 2,
      matchAccuracy: 0.5,
      courtAccuracy: 0.667,
      averageBrierScore: 0.162,
      averageLineupAdherence: 0.917,
      exactScores: 1,
    })
  })
})
