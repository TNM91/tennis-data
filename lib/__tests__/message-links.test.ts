import { describe, expect, it } from 'vitest'
import { buildDirectMessageHref, buildSupportMessageHref } from '../message-links'

describe('message link builders', () => {
  it('routes support requests into internal TenAceIQ messages', () => {
    const href = buildSupportMessageHref({
      category: 'billing',
      subject: 'Captain access request',
      body: 'Please review this upgrade.',
      entityType: 'billing',
      entityId: 'captain',
    })

    const url = new URL(href, 'https://tenaceiq.test')
    expect(url.pathname).toBe('/messages')
    expect(url.searchParams.get('compose')).toBe('support')
    expect(url.searchParams.get('category')).toBe('billing')
    expect(url.searchParams.get('subject')).toBe('Captain access request')
    expect(url.searchParams.get('body')).toBe('Please review this upgrade.')
    expect(url.searchParams.get('entityType')).toBe('billing')
    expect(url.searchParams.get('entityId')).toBe('captain')
    expect(href).not.toContain('mailto:')
  })

  it('omits blank optional fields from direct message links', () => {
    const href = buildDirectMessageHref({
      recipientName: '  ',
      subject: 'Lineup question',
      body: '',
      recipientPlayerId: 'player-1',
    })

    const url = new URL(href, 'https://tenaceiq.test')
    expect(url.searchParams.get('compose')).toBe('direct')
    expect(url.searchParams.get('subject')).toBe('Lineup question')
    expect(url.searchParams.get('recipient')).toBeNull()
    expect(url.searchParams.get('body')).toBeNull()
    expect(url.searchParams.get('recipientPlayerId')).toBe('player-1')
  })
})
