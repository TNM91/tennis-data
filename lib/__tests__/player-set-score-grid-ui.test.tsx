import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PlayerSetScoreGrid from '@/app/components/player-set-score-grid'

describe('player set-score grid data states', () => {
  it('labels won and lost sets explicitly rather than relying on color', () => {
    const html = renderToStaticMarkup(createElement(PlayerSetScoreGrid, { playerName: 'Alex', matches: [{ id: 'm', matchType: 'singles', result: 'L', score: '7-6 4-6 3-6' }] }))
    expect(html).toContain('7–6: 1 sets won, 0 lost')
    expect(html).toContain('3 sets · 1 won / 2 lost')
    expect(html).toContain('Set results include wins inside lost matches')
  })
  it('defaults to doubles for a doubles-only player and labels the partner scope', () => {
    const html = renderToStaticMarkup(createElement(PlayerSetScoreGrid, { playerName: 'Alex', matches: [{ id: 'm', matchType: 'doubles', result: 'W', score: '6-1 6-4' }] }))
    expect(html).toContain('Doubles set wins and losses by score')
    expect(html).toContain('Doubles combines every recorded partner')
  })
  it('keeps zero samples unavailable and explains excluded matches', () => {
    const html = renderToStaticMarkup(createElement(PlayerSetScoreGrid, { playerName: 'Alex', initialMode: 'singles', matches: [{ id: 'm', matchType: 'singles', result: null, score: '6-1 6-4' }] }))
    expect(html).toContain('No complete, decided singles scores')
    expect(html).toContain('1 match excluded')
    expect(html).not.toContain('0% won')
  })
})
