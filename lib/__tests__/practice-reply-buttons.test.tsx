import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PracticeReplyButtons } from '@/app/pr/[code]/practice-rsvp-client'
import type { PracticeResponseStatus } from '../captain-practice-rsvp'

function render(selectedResponse: PracticeResponseStatus | undefined, saving: PracticeResponseStatus | '' = '') {
  return renderToStaticMarkup(createElement(PracticeReplyButtons, { selectedResponse, saving, onRespond: () => {} }))
}

describe('practice reply selection', () => {
  it.each(['in', 'maybe', 'out'] as const)('highlights only the saved %s response', (status) => {
    const buttons = render(status).match(/<button\b[^>]*>.*?<\/button>/g) || []
    expect(buttons).toHaveLength(3)
    expect(buttons.filter((button) => button.includes('aria-pressed="true"'))).toHaveLength(1)
    expect(buttons[['in', 'maybe', 'out'].indexOf(status)]).toContain('aria-pressed="true"')
  })

  it.each([undefined, 'unanswered'] as const)('does not imply an affirmative reply for %s', (status) => {
    expect(render(status)).not.toContain('aria-pressed="true"')
  })

  it('keeps the saved response selected while a different reply is saving', () => {
    const html = render('in', 'out')
    expect(html).toContain('aria-busy="true"')
    expect(html.match(/disabled=""/g)).toHaveLength(3)
    expect(html).toContain('aria-pressed="true">I’m in</button>')
    expect(html).toContain('aria-pressed="false">Saving...</button>')
  })
})
