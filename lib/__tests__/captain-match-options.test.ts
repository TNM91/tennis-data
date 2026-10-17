import { expect, it } from 'vitest'
import { orderCaptainMatchOptions, uniqueCaptainMatchOptions } from '@/lib/captain-match-options'
const schedule = { id: 'schedule', home_team: 'A', away_team: 'B', match_date: '2026-10-11', league_name: 'Fall', flight: '4.5', winner_side: null }
const result = { ...schedule, id: 'result', winner_side: 'A' }
it('lists the nearest upcoming matches before recent history and undated fixtures', () => {
  const dates = ['2027-01-10', '2026-10-11', null, '2026-10-18', '2026-09-13', '2026-10-16']
  const rows = dates.map((match_date, id) => ({ ...schedule, id: String(id), match_date }))
  expect(orderCaptainMatchOptions(rows, '2026-10-16').map(row => row.match_date)).toEqual(['2026-10-16', '2026-10-18', '2027-01-10', '2026-10-11', '2026-09-13', null])
  expect(rows.map(row => row.match_date)).toEqual(dates)
})
it('combines schedule and result options, preferring the result', () => {
  expect(uniqueCaptainMatchOptions([schedule, result], '')).toEqual([result])
})
it('preserves a saved selection in either input order', () => {
  expect(uniqueCaptainMatchOptions([schedule, result], 'schedule')).toEqual([schedule])
  expect(uniqueCaptainMatchOptions([result, schedule], 'schedule')).toEqual([schedule])
})
it('keeps distinct dates, scopes and incomplete identities', () => {
  const rows = [schedule, { ...schedule, id: 'date', match_date: '2026-10-18' }, { ...schedule, id: 'flight', flight: '4.0' }, { ...schedule, id: 'league', league_name: 'Spring' }, { ...schedule, id: 'unknown', match_date: null }]
  expect(uniqueCaptainMatchOptions(rows, '')).toEqual(rows)
})
