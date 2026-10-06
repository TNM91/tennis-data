import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CaptainMessageSendFocus from '@/app/components/captain-message-send-focus'

const props = { recipients: ['Alex', 'Sam'], body: 'Court 1: Alex + Sam\nArrive at 6:30.', title: 'Saturday lineup', match: 'Oct 10 · Baseline Crew', smsHref: 'sms:123,456?body=draft', allowed: true, loading: false, onOpenTexts: () => {} }
describe('Captain team text review', () => {
  it('shows the current draft and audience before a single native handoff', () => {
    const html = renderToStaticMarkup(createElement(CaptainMessageSendFocus, props))
    expect(html).toContain('2 recipients')
    expect(html).toContain(props.body)
    expect(html).toContain('href="sms:123,456?body=draft"')
    expect(html).toContain('Opening it does not confirm delivery')
    expect(html).toContain('<details')
    expect(html).not.toContain('<details open')
  })
  it.each([{ recipients: [] }, { body: '   ' }, { allowed: false }, { loading: true }])('prevents handoff when the draft cannot be sent: %j', (change) => {
    const html = renderToStaticMarkup(createElement(CaptainMessageSendFocus, { ...props, ...change }))
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('href="sms:')
  })
  it('keeps loading failures visible outside the optional tools', () => {
    expect(renderToStaticMarkup(createElement(CaptainMessageSendFocus, { ...props, error: 'Team contacts could not load.' }))).toContain('role="alert"')
  })
})
