import { expect, it } from 'vitest'
import { indexTeamDirectoryRoster, teamDirectoryRosterKey } from '@/lib/team-directory-roster'

it('includes roster-only players once and keeps league and flight scopes separate', () => {
  const row = { team_name: 'Meinert / Guys', league_name: 'Fall', flight: '4.5', player_id: 'one' }
  const index = indexTeamDirectoryRoster([row, row, { ...row, player_id: 'two' }, { ...row, league_name: 'Spring', player_id: 'three' }, { ...row, flight: '4.0', player_id: 'four' }, { ...row, player_id: null }])
  expect(index[teamDirectoryRosterKey(' MEINERT/Guys ', 'fall', '4.5')]).toEqual(['one', 'two'])
  expect(index[teamDirectoryRosterKey(row.team_name, 'Spring', '4.5')]).toEqual(['three'])
  expect(index[teamDirectoryRosterKey(row.team_name, 'Fall', '4.0')]).toEqual(['four'])
  expect(new Set(['one', ...index[teamDirectoryRosterKey(row.team_name, 'Fall', '4.5')]]).size).toBe(2)
})
