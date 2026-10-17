import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CaptainMatchWeekRail from '@/app/components/captain-match-week-rail'

const scope = { team: 'Court Aces', date: '2026-10-10', opponent: 'Baseline Crew' }

describe('Captain match-week progress', () => {
  it('does not complete previous steps when the captain visits messaging', () => {
    const html = renderToStaticMarkup(createElement(CaptainMatchWeekRail, { current: 'messaging', scope }))
    expect(html).not.toContain('Done')
    expect(html).toContain('aria-current="step"')
  })

  it('marks only verified steps complete and keeps unsaved work visible', () => {
    const html = renderToStaticMarkup(createElement(CaptainMatchWeekRail, {
      current: 'messaging', scope,
      progress: {
        lineup: { complete: false, label: 'Save lineup' },
        availability: { complete: true, label: '8/8 confirmed' },
        messaging: { complete: false, label: 'Send in texts' },
      },
    }))
    expect(html.match(/>Done</g)).toHaveLength(1)
    expect(html).toContain('Save lineup')
    expect(html).toContain('8/8 confirmed')
    expect(html).toContain('Send in texts')
  })

  it('shows schedule setup instead of progress without a selected match', () => {
    const html = renderToStaticMarkup(createElement(CaptainMatchWeekRail, {
      current: 'lineup', scope: { team: 'Court Aces' },
      progress: { lineup: { complete: true, label: 'Lineup saved' } },
    }))
    expect(html).toContain('Add schedule')
    expect(html).not.toContain('Done')
  })
})
