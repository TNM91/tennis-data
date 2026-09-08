import { describe, expect, it } from 'vitest'
import { getLocalIsoDate, parseCaptainCalendarDate } from '../captain-calendar-date'

describe('captain calendar dates', () => {
  it('keeps a date-only match on the scheduled calendar day', () => {
    const parsed = parseCaptainCalendarDate('2026-09-14')

    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(8)
    expect(parsed?.getDate()).toBe(14)
  })

  it('builds the query date from the local calendar day', () => {
    expect(getLocalIsoDate(new Date(2026, 8, 8, 23, 45))).toBe('2026-09-08')
  })

  it('returns null for missing or invalid dates', () => {
    expect(parseCaptainCalendarDate(null)).toBeNull()
    expect(parseCaptainCalendarDate('not-a-date')).toBeNull()
  })
})
