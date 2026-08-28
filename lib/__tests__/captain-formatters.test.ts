import { describe, expect, it } from 'vitest'
import { buildSmsHref, getSmsBodySeparator, isAppleSmsComposer } from '../captain-formatters'

describe('captain SMS links', () => {
  it('uses Apple’s documented recipient-only Messages handoff on iPhone', () => {
    expect(isAppleSmsComposer('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(getSmsBodySeparator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('')
    expect(buildSmsHref(['(314) 555-0100'], 'Can you play?', 'iPhone')).toBe('sms:3145550100')
  })

  it('keeps the standard query separator for non-iPhone devices', () => {
    expect(getSmsBodySeparator('Mozilla/5.0 (Linux; Android 15)')).toBe('?')
    expect(buildSmsHref(['(314) 555-0100'], 'Can you play?', 'Android')).toBe('sms:3145550100?body=Can%20you%20play%3F')
  })
})
