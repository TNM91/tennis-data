import { describe, expect, it } from 'vitest'
import {
  TEAM_MATCH_FORMATS,
  TOURNAMENT_DRAW_FORMATS,
  getTeamMatchFormatSummary,
  normalizeTournamentDrawFormatId,
  resolveTeamMatchFormat,
} from '../competition-format-registry'

describe('competition format registry', () => {
  it.each([
    ['2026 Adult 18 & Over', 'Women 3.5', 'standard_2s_3d', 2, 3],
    ['2026 Adult 18 & Over', 'Women 2.5', 'adult_18_1s_2d', 1, 2],
    ['2026 Adult 40 & Over', 'Men 4.0', 'adult_40_1s_4d', 1, 4],
    ['2026 Adult 40 & Over - 4 Line (1S/3D)', 'Women 4.0', 'adult_40_1s_3d', 1, 3],
    ['2026 Adult 55 & Over', 'Women 7.0', 'three_doubles', 0, 3],
    ['2026 Mixed 18 & Over', '8.0', 'three_doubles', 0, 3],
    ['2026 Combo Doubles', 'Women 7.5', 'three_doubles', 0, 3],
    ['Club Singles League', 'Flight A', 'one_singles', 1, 0],
    ['Dominant Duo Team Tournament', 'Open', 'dominant_duo', 2, 1],
  ])('resolves %s / %s', (leagueName, flight, id, singles, doubles) => {
    const format = resolveTeamMatchFormat({ leagueName, flight })
    const summary = getTeamMatchFormatSummary(format)
    expect(format.id).toBe(id)
    expect(summary.singles).toBe(singles)
    expect(summary.doubles).toBe(doubles)
  })

  it('keeps Tri-Level ratings on the three doubles lines', () => {
    const format = resolveTeamMatchFormat({
      leagueName: 'USTA Tri-Level 3.5 / 4.0 / 4.5',
      flight: 'Women',
    })

    expect(format.id).toBe('tri_level')
    expect(format.slots.map((slot) => slot.label)).toEqual([
      '3.5 Doubles',
      '4.0 Doubles',
      '4.5 Doubles',
    ])
    expect(format.slots.map((slot) => slot.ratingLevel)).toEqual([3.5, 4, 4.5])
  })

  it('supports mixed Tri-Level and preserves combined levels', () => {
    const format = resolveTeamMatchFormat({
      leagueName: 'Mixed Tri Level Combo',
      flight: '7.0 / 8.0 / 9.0',
    })

    expect(format.id).toBe('mixed_tri_level')
    expect(format.slots.map((slot) => slot.label)).toEqual([
      '7.0 Mixed Doubles',
      '8.0 Mixed Doubles',
      '9.0 Mixed Doubles',
    ])
  })

  it('accepts local line compositions without another code change', () => {
    const format = resolveTeamMatchFormat({
      leagueName: 'Local Adult League - 3 Singles / 2 Doubles',
      flight: 'Open',
    })

    expect(format.id).toBe('custom')
    expect(format.inferredBy).toBe('line_composition')
    expect(getTeamMatchFormatSummary(format)).toMatchObject({ singles: 3, doubles: 2, courts: 5, players: 7 })
  })

  it('lets TIQ explicitly select any registered team scorecard', () => {
    for (const format of TEAM_MATCH_FORMATS.filter((item) => item.id !== 'custom')) {
      expect(resolveTeamMatchFormat({ explicitFormatId: format.id }).id).toBe(format.id)
    }
  })

  it('keeps every current USTA tournament draw format as a distinct value', () => {
    expect(TOURNAMENT_DRAW_FORMATS).toHaveLength(11)
    for (const format of TOURNAMENT_DRAW_FORMATS) {
      expect(normalizeTournamentDrawFormatId(format.id)).toBe(format.id)
    }
  })
})
