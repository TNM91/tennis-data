import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import CaptainCourtScoreComparison from '../../app/components/captain-court-score-comparison'

it('keeps comparisons collapsed and explains pair samples and missing opponents', () => {
  const html = renderToStaticMarkup(createElement(CaptainCourtScoreComparison, {
    mode: 'doubles', team: { ids: ['a', 'b'], names: ['Alice', 'Bea'] },
    opponent: { ids: [], names: [] }, histories: {},
  }))
  expect(html).toContain('<details')
  expect(html).not.toMatch(/<details[^>]*\bopen/)
  expect(html).toContain('Alice / Bea')
  expect(html).toContain('Complete this court to compare.')
  expect(html).toContain('Only matches played together by each pair.')
  expect(html).toContain('No scored matches yet.')
})
