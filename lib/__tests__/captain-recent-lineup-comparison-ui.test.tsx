import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import CaptainRecentLineupComparison from '../../app/components/captain-recent-lineup-comparison'
import { compareRecentOpponentLineups } from '../captain-recent-lineup-comparison'

it('keeps comparison and individual courts closed, with an explicit empty state', () => {
  const comparison = compareRecentOpponentLineups({ ready: true, fixtures: [], lines: [] }, [{ id: 's1', label: 'Singles 1', slotType: 'singles', players: [] }], () => null)
  const html = renderToStaticMarkup(createElement(CaptainRecentLineupComparison, { comparison, onReviewCourt: () => {} }))
  expect(html).toContain('Test your draft against recent lineups')
  expect(html).toContain('Complete your court')
  expect(html).toContain('Review Singles 1')
  expect(html).not.toMatch(/<details[^>]*\sopen/)
  expect(html).toContain('not assessed')
})
