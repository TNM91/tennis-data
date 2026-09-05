import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getCaptainQuickStartSteps, hasCompleteSavedLineup } from '../captain-quick-start'
import type { TeamConnection } from '../team-profile-links'

const team: TeamConnection = {
  id: 'a', teamName: 'A & B', leagueName: 'Summer / Fall', flight: '4.0', role: 'captain', roles: ['captain'],
  status: 'accepted', sourceType: 'data_assist_import', sourceRecordId: 'import', matchedPlayerId: '',
  isDefault: true, isRoleUpdate: false, declinedRoles: [], roleAcceptedAt: {}, archivedAt: '', updatedAt: '',
}
const player = (id: string) => ({ playerId: id, playerName: `Player ${id}` })

describe('Captain quick start', () => {
  it('compacts only the guide summary while preserving first-time help and direct links', () => {
    const component = readFileSync(resolve(process.cwd(), 'app/components/captain-quick-start.tsx'), 'utf8')
    const css = readFileSync(resolve(process.cwd(), 'app/components/captain-quick-start.module.css'), 'utf8')
    expect(component).toContain('compact = false')
    expect(component).toContain("compact ? 'Setup guide' : 'Set up your team'")
    expect(component).toContain('!compact ? <small>Five steps')
    expect(component).toContain("window.location.hash === '#captain-setup'")
    expect(component).toContain('onToggle={(event) => setOpen(event.currentTarget.open)}')
    expect(component).toContain('{open ? <div className={styles.content}>')
    expect(css).toContain('.guide.compact { margin: 0;')
    expect(css).toContain('box-sizing: border-box; min-height: 44px;')
  })
  it('starts a new team with no completed steps', () => {
    expect(getCaptainQuickStartSteps().filter((step) => step.complete)).toHaveLength(0)
  })
  it('does not confuse an imported/pending team with an accepted connection', () => {
    const steps = getCaptainQuickStartSteps({ ...team, status: 'pending' })
    expect(steps.map((step) => step.complete)).toEqual([true, false, false, false, false])
    expect(steps[3].href).toBe('/team-connections')
  })
  it('ignores stale completion after a team is unlinked or archived', () => {
    const evidence = { teammateConnected: true, lineupSaved: true, lineupSent: true, match: { date: '', opponent: '' } }
    expect(getCaptainQuickStartSteps({ ...team, status: 'unlinked' }, evidence).some((step) => step.complete)).toBe(false)
    expect(getCaptainQuickStartSteps({ ...team, archivedAt: '2026-09-01' }, evidence).some((step) => step.complete)).toBe(false)
  })
  it('carries the selected team, league, flight and saved match without leaking another scope', () => {
    const steps = getCaptainQuickStartSteps(team, { teammateConnected: true, lineupSaved: true, lineupSent: true, match: { date: '2026-09-14', opponent: 'C + D' } })
    expect(steps.every((step) => step.complete)).toBe(true)
    const href = new URL(steps[4].href, 'https://example.test')
    expect(href.pathname).toBe('/captain/matchup-sheet')
    expect(Object.fromEntries(href.searchParams)).toMatchObject({ team: 'A & B', league: 'Summer / Fall', flight: '4.0', date: '2026-09-14', opponent: 'C + D', confirmed: '1' })
    expect(new URL(getCaptainQuickStartSteps({ ...team, sourceType: 'tiq_entry' })[3].href, 'https://example.test').searchParams.get('layer')).toBe('tiq')
  })
  it('requires filled singles/doubles courts and unique player IDs', () => {
    expect(hasCompleteSavedLineup([{ slotType: 'singles', players: [player('a')] }, { slotType: 'doubles', players: [player('b'), player('c')] }])).toBe(true)
    for (const slots of [null, [], [{}], [{ slotType: 'doubles', players: [player('a')] }], [{ slotType: 'doubles', players: [player('a'), player('a')] }], [{ slotType: 'singles', players: [{ playerName: 'A' }] }]]) {
      expect(hasCompleteSavedLineup(slots)).toBe(false)
    }
  })
})
