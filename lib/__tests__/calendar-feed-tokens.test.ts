import { describe, expect, it } from 'vitest'

import { createCalendarFeedToken, hashCalendarFeedToken } from '../calendar-feed-tokens'

describe('calendar feed tokens', () => {
  it('creates URL-safe secrets and stores deterministic hashes', () => {
    const token = createCalendarFeedToken()
    const hash = hashCalendarFeedToken(token)

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThan(30)
    expect(hash).toHaveLength(64)
    expect(hashCalendarFeedToken(` ${token} `)).toBe(hash)
    expect(hash).not.toBe(token)
  })
})
