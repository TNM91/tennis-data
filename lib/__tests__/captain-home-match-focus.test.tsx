import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCaptainHomeMatchFocus } from '@/lib/captain-home-match-focus'
import CaptainHomeMatchFocusCard from '@/app/components/captain-home-match-focus'

const matchDate = '2026-10-10'
const courts = [
  { label: 'Doubles 1', slotType: 'doubles', players: ['Alex', 'Jordan'] },
  { label: 'Doubles 2', slotType: 'doubles', players: ['Sam', 'Taylor'] },
]
const people = courts.flatMap((court) => court.players.map((name) => ({ name, status: 'confirmed' })))
const ready = { hasTeam: true, matchDate, lineup: { matchDate, courts }, availability: { matchDate, people } }

describe('Captain Home match focus', () => {
  it('starts with team and schedule setup when they are missing', () => {
    const noTeam = buildCaptainHomeMatchFocus({ ...ready, hasTeam: false })
    expect(noTeam.action.kind).toBe('team')
    expect(noTeam.courtsLabel).toBe('Not built')
    expect(buildCaptainHomeMatchFocus({ ...ready, matchDate: '' }).action.kind).toBe('schedule')
  })
  it('rejects another match’s lineup, confirmations, and sent receipt', () => {
    const focus = buildCaptainHomeMatchFocus({ ...ready, matchDate: '2026-10-17', lineup: { ...ready.lineup, sent: true } })
    expect(focus.action.kind).toBe('lineup')
    expect(focus.courtsLabel).toBe('Not built')
    expect(focus.confirmedLabel).toBe('Not selected')
  })
  it('does not treat a saved court row with missing players as filled', () => {
    const focus = buildCaptainHomeMatchFocus({ ...ready, lineup: { matchDate, courts: [courts[0], { ...courts[1], players: ['Sam', ''] }] } })
    expect(focus.courtsLabel).toBe('1/2 filled')
    expect(focus.action.label).toBe('Finish courts')
    expect(focus.issues.some((issue) => issue.label.includes('Doubles 2'))).toBe(true)
  })
  it('prioritizes a selected player marked out over missing replies', () => {
    const focus = buildCaptainHomeMatchFocus({ ...ready, availability: { matchDate, people: [{ name: 'Alex', status: 'declined' }] } })
    expect(focus.action.kind).toBe('replace')
    expect(focus.issues[0].label).toContain('Alex: out')
    expect(focus.waitingLabel).toBe('3')
  })
  it('does not treat absent court rows as a complete lineup', () => {
    const focus = buildCaptainHomeMatchFocus({ ...ready, lineup: { ...ready.lineup, expectedCourtCount: 3 } })
    expect(focus.courtsLabel).toBe('2/3 filled')
    expect(focus.action.label).toBe('Finish courts')
    expect(focus.issues[0].label).toContain('1 court still needs players')
  })
  it('prioritizes a late arrival or court requiring captain follow-up', () => {
    expect(buildCaptainHomeMatchFocus({ ...ready, availability: { matchDate, people: [{ name: 'Alex', status: 'running-late' }] } }).action.kind).toBe('court')
    expect(buildCaptainHomeMatchFocus({ ...ready, lineup: { ...ready.lineup, attentionCourtLabels: ['Doubles 1'] } }).action.kind).toBe('court')
  })
  it('counts confirmations only for players in this lineup', () => {
    const focus = buildCaptainHomeMatchFocus({ ...ready, availability: { matchDate, people: [...people, { name: 'Backup', status: 'no' }] } })
    expect(focus.confirmedLabel).toBe('4/4 in')
    expect(focus.waitingLabel).toBe('0')
    expect(focus.action.kind).toBe('send')
    expect(focus.issues).toEqual([])
  })
  it('asks for confirmation when response data is absent or tentative', () => {
    expect(buildCaptainHomeMatchFocus({ ...ready, availability: null }).action.kind).toBe('availability')
    const focus = buildCaptainHomeMatchFocus({ ...ready, availability: { matchDate, people: people.map((person) => ({ ...person, status: 'maybe' })) } })
    expect(focus.confirmedLabel).toBe('0/4 in')
    expect(focus.waitingLabel).toBe('4')
  })
  it('uses verified court confirmations without overriding a newer decline', () => {
    const confirmedLineup = { ...ready.lineup, confirmedCourtLabels: ['Doubles 1', 'Doubles 2'] }
    expect(buildCaptainHomeMatchFocus({ ...ready, lineup: confirmedLineup, availability: null }).confirmedLabel).toBe('4/4 in')
    expect(buildCaptainHomeMatchFocus({ ...ready, lineup: confirmedLineup, availability: { matchDate, people: [{ name: 'Alex', status: 'no' }] } }).action.kind).toBe('replace')
  })
  it('requires correcting duplicate players before sending', () => {
    const focus = buildCaptainHomeMatchFocus({ ...ready, lineup: { matchDate, courts: [courts[0], { ...courts[1], players: ['Alex', 'Taylor'] }] } })
    expect(focus.action.kind).toBe('lineup')
    expect(focus.issues.some((issue) => issue.label.includes('more than one court'))).toBe(true)
  })
  it('recognizes a verified sent lineup but still surfaces a later player decline', () => {
    const sent = { ...ready, lineup: { ...ready.lineup, sent: true } }
    expect(buildCaptainHomeMatchFocus(sent).action.kind).toBe('chat')
    expect(buildCaptainHomeMatchFocus({ ...sent, availability: { matchDate, people: [{ name: 'Alex', status: 'out' }] } }).action.kind).toBe('replace')
  })
  it('renders one primary action and no attention list for a ready match', () => {
    const html = renderToStaticMarkup(createElement(CaptainHomeMatchFocusCard, { focus: buildCaptainHomeMatchFocus(ready), disabled: false, onAction: () => {} }))
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('Review &amp; send lineup')
    expect(html).not.toContain('Match needs attention')
  })
})
