import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCaptainConfirmationFocus, readScopedConfirmationSelections, type ConfirmationPlayer } from '@/lib/captain-confirmation-focus'
import CaptainConfirmationFocusPanel from '@/app/components/captain-confirmation-focus'

const scope = { team: 'Court Aces', league: 'USTA', flight: '4.0', date: '2026-10-10', opponent: 'Baseline Crew' }
const source = { ...scope, slots: [{ players: [{ playerId: 'alex', playerName: 'Alex' }, { playerId: 'sam', playerName: 'Sam' }] }] }
const roster: ConfirmationPlayer[] = [{ id: 'alex', name: 'Alex', status: 'in' }, { id: 'sam', name: 'Sam', status: 'unanswered' }, { id: 'backup', name: 'Backup', status: 'out' }]
const selected = [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }]

describe('Captain confirmation focus', () => {
  it.each([{ team: 'Another team' }, { date: '2026-10-17' }, { league: 'Other league' }, { flight: '3.5' }, { opponent: 'Other opponent' }])('rejects a lineup from another match or team scope', (changes) => {
    expect(readScopedConfirmationSelections(scope, { ...source, ...changes })).toBeNull()
  })
  it('reads draft and shared court shapes without duplicating selected players', () => {
    expect(readScopedConfirmationSelections(scope, { ...source, slots: [...source.slots, { players: ['Taylor', 'Taylor', { playerId: 'alex', playerName: 'Alex' }] }] })).toEqual([...selected, { id: '', name: 'Taylor' }])
  })
  it('separates selected replies, confirmations, and the rest of the team', () => {
    const focus = buildCaptainConfirmationFocus(roster, selected, false)
    expect(focus.confirmed.map((player) => player.name)).toEqual(['Alex'])
    expect(focus.attention.map((player) => player.name)).toEqual(['Sam'])
    expect(focus.others.map((player) => player.name)).toEqual(['Backup'])
    expect(focus.total).toBe(2)
    expect(focus.nextAction).toBe('chase')
  })
  it('puts out and maybe replies before missing replies and returns for an out player', () => {
    const players: ConfirmationPlayer[] = [{ id: 'a', name: 'A', status: 'unanswered' }, { id: 'b', name: 'B', status: 'maybe' }, { id: 'c', name: 'C', status: 'out' }]
    const focus = buildCaptainConfirmationFocus(players, players.map(({ id, name }) => ({ id, name })), true)
    expect(focus.attention.map((player) => player.status)).toEqual(['out', 'maybe', 'unanswered'])
    expect(focus.nextAction).toBe('lineup')
  })
  it('keeps selected players missing from the roster visible and unconfirmed', () => {
    const focus = buildCaptainConfirmationFocus(roster, [...selected, { id: 'missing', name: 'Missing Player' }], false)
    expect(focus.selected).toHaveLength(3)
    expect(focus.attention.find((player) => player.id === 'missing')?.missingRoster).toBe(true)
    expect(focus.nextAction).toBe('lineup')
  })
  it('does not confirm an ambiguous name without a matching player ID', () => {
    const focus = buildCaptainConfirmationFocus([{ id: 'a', name: 'Alex', status: 'in' }, { id: 'b', name: 'Alex', status: 'in' }], [{ id: '', name: 'Alex' }], false)
    expect(focus.confirmed).toEqual([])
    expect(focus.selected[0].missingRoster).toBe(true)
  })
  it('asks first and chases only after sharing or receiving replies', () => {
    const unanswered = roster.map((player) => ({ ...player, status: 'unanswered' as const }))
    expect(buildCaptainConfirmationFocus(unanswered, selected, false).nextAction).toBe('ask')
    expect(buildCaptainConfirmationFocus(unanswered, selected, true).nextAction).toBe('chase')
  })
  it('returns to the lineup when every selected player is in, regardless of reserve replies', () => {
    const focus = buildCaptainConfirmationFocus(roster.map((player) => player.id === 'sam' ? { ...player, status: 'in' } : player), selected, true)
    expect(focus.nextAction).toBe('lineup')
    expect(focus.confirmed).toHaveLength(2)
    expect(focus.attention).toEqual([])
  })
  it('keeps confirmed and reserve lists collapsed with one primary action', () => {
    const html = renderToStaticMarkup(createElement(CaptainConfirmationFocusPanel, { focus: buildCaptainConfirmationFocus(roster, selected, false), loading: false, disabled: false, onAction: () => {}, onReview: () => {} }))
    expect(html).toContain('Confirmed (1)')
    expect(html).toContain('Rest of team')
    expect(html).not.toMatch(/<details[^>]*\sopen/)
    expect(html.match(/<button/g)).toHaveLength(2) // One primary action plus the reserve player's optional review.
  })
})
