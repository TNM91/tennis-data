import { describe, expect, it } from 'vitest'
import { isPortalTaskActive } from '../portal-task-active'

describe('portal task active routing', () => {
  it('keeps Find subtabs active across public aliases', () => {
    expect(isPortalTaskActive('/players/123', '/explore/players')).toBe(true)
    expect(isPortalTaskActive('/teams/smash-club', '/explore/teams')).toBe(true)
    expect(isPortalTaskActive('/leagues/local-ladder', '/explore/leagues')).toBe(true)
    expect(isPortalTaskActive('/rankings', '/explore/rankings')).toBe(true)
  })

  it('keeps You tools active on related data and message routes', () => {
    expect(isPortalTaskActive('/admin/data-assist?batch=abc', '/data-assist')).toBe(true)
    expect(isPortalTaskActive('/messages#alerts', '/messages')).toBe(true)
    expect(isPortalTaskActive('/matchup?playerA=1', '/matchup')).toBe(true)
  })

  it('requires hash tasks to match the current hash exactly', () => {
    expect(isPortalTaskActive('/coach', '/coach#coach-linked-dashboard')).toBe(false)
    expect(isPortalTaskActive('/coach#coach-linked-dashboard', '/coach#coach-linked-dashboard')).toBe(true)
    expect(isPortalTaskActive('/coach#other-section', '/coach#coach-linked-dashboard')).toBe(false)
  })

  it('groups captain sub-tools under the selected Team submenu icon', () => {
    expect(isPortalTaskActive('/captain/practice', '/captain/practice')).toBe(true)
    expect(isPortalTaskActive('/captain/lineup-projection', '/captain/lineup-builder')).toBe(true)
    expect(isPortalTaskActive('/captain/scenario-builder', '/captain/lineup-builder')).toBe(true)
    expect(isPortalTaskActive('/captain/team-brief', '/captain/weekly-brief')).toBe(true)
    expect(isPortalTaskActive('/captain/lineup-availability', '/captain/availability')).toBe(true)
  })

  it('groups league workspaces under the selected League submenu icon', () => {
    expect(isPortalTaskActive('/league-coordinator/tournaments', '/league-coordinator/tournaments')).toBe(true)
    expect(isPortalTaskActive('/league-coordinator/tournaments', '/compete/schedule')).toBe(false)
    expect(isPortalTaskActive('/compete/schedule?leagueId=one', '/compete/schedule')).toBe(true)
    expect(isPortalTaskActive('/league-coordinator/results', '/league-coordinator/results')).toBe(true)
    expect(isPortalTaskActive('/compete/results', '/league-coordinator/individual-results')).toBe(true)
  })
})
