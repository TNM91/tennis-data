import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import CaptainRecentLineupSwaps from '../../app/components/captain-recent-lineup-swaps'
import type { RecentLineupSwap } from '../captain-recent-lineup-swaps'

const swap: RecentLineupSwap = { id: 'swap', signature: 'draft', sourceId: 's1', targetId: 's2', labels: ['Singles 1', 'Singles 2'], names: [['First player'], ['Second player']], improvedWeeks: 2, beforeMean: 1, afterMean: 1.2,
  ranking: 'team-match', rankingGain: 0.2, fixtureCount: 3, teamWeeks: 2, teamBeforeMean: 0.16, teamAfterMean: 0.36, neededWins: 2, courtCount: 2,
  courts: [{ label: 'Singles 1', before: 0.2, after: 0.6 }, { label: 'Singles 2', before: 0.8, after: 0.6 }],
  weeks: [{ key: 'w1', date: '2026-10-04', before: [0.2, 0.8], after: [0.6, 0.6], gain: 0.2, teamBefore: 0.16, teamAfter: 0.36 }, { key: 'w2', date: '2026-09-27', before: [0.2, 0.8], after: [0.6, 0.6], gain: 0.2, teamBefore: 0.16, teamAfter: 0.36 }] }
it('keeps swap details closed and shows the weaker court tradeoff before applying', () => {
  const html = renderToStaticMarkup(createElement(CaptainRecentLineupSwaps, { suggestions: [swap], onApply: () => {}, disabled: true }))
  expect(html).not.toMatch(/<details[^>]*\sopen/)
  expect(html).toContain('80% → 60%')
  expect(html).toContain('1.00 → 1.20 out of 2')
  expect(html).toContain('Team-match win estimate')
  expect(html).toContain('16% → 36%')
  expect(html).toContain('2/3 recorded weeks fully assessed')
  expect(html).toContain('Tied court counts are excluded')
  expect(html).toContain('none worse')
  expect(html).toMatch(/<button[^>]+disabled=""/)
  expect(html).toContain('Updates your draft')
})
it('labels partial evidence as court-only and does not present a team win estimate', () => {
  const partial = { ...swap, ranking: 'court-wins' as const, teamWeeks: 0, teamBeforeMean: null, teamAfterMean: null, weeks: swap.weeks.map((week) => ({ ...week, teamBefore: null, teamAfter: null })) }
  const html = renderToStaticMarkup(createElement(CaptainRecentLineupSwaps, { suggestions: [partial], onApply: () => {} }))
  expect(html).toContain('Court-only ranking')
  expect(html).not.toContain('Team-match win estimate')
  expect(html).toContain('Team-match not assessed')
})
it('rounds an averaged half-percent estimate consistently', () => {
  const html = renderToStaticMarkup(createElement(CaptainRecentLineupSwaps, { suggestions: [{ ...swap, teamBeforeMean: (0.285 + 0.285 + 0.285) / 3 }], onApply: () => {} }))
  expect(html).toContain('29% → 36%')
})
it('explains why no supported swap is available', () => {
  const html = renderToStaticMarkup(createElement(CaptainRecentLineupSwaps, { suggestions: [], onApply: () => {} }))
  expect(html).toContain('No supported swaps yet')
  expect(html).toContain('at least two recorded weeks')
  expect(html).not.toContain('<button')
})
