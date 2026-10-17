import { describe, expect, it } from 'vitest'
import { buildSmsHref, getSmsBodySeparator, isAppleSmsComposer, formatShortDate, parseDisplayDate } from '../captain-formatters'

describe('scheduled calendar dates', () => {
  it('keeps a date-only match on its local calendar day', () => {
    const date = parseDisplayDate('2026-10-18')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 18])
    expect(formatShortDate('2026-10-18')).toBe(new Date(2026, 9, 18).toLocaleDateString())
  })

  it('uses the supplied empty-state label when no match date is selected', () => {
    expect(formatShortDate(null, 'Select a scheduled match')).toBe('Select a scheduled match')
  })
})

describe('captain SMS links', () => {
  it('uses an iPhone Messages handoff with a prefilled body', () => {
    expect(isAppleSmsComposer('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(getSmsBodySeparator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('&')
    expect(buildSmsHref(['(314) 555-0100'], 'Can you play?', 'iPhone')).toBe('sms:3145550100&body=Can%20you%20play%3F')
  })

  it('keeps the standard query separator for non-iPhone devices', () => {
    expect(getSmsBodySeparator('Mozilla/5.0 (Linux; Android 15)')).toBe('?')
    expect(buildSmsHref(['(314) 555-0100'], 'Can you play?', 'Android')).toBe('sms:3145550100?body=Can%20you%20play%3F')
  })
})
