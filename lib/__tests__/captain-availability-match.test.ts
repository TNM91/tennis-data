import { describe, expect, it } from 'vitest'
import { chooseAvailabilityMatch } from '../captain-availability-match'

const matches = [
  { id: 'later', match_date: '2026-11-22', opponent: 'Schnamellton' },
  { id: 'next', match_date: '2026-10-18', opponent: 'Hodge-Kamman' },
  { id: 'past', match_date: '2026-10-04', opponent: 'Other' },
]
const context = { selectedId: '', date: '', opponent: '', today: '2026-10-16', getOpponent: (match: typeof matches[number]) => match.opponent }

describe('captain availability match selection', () => {
  it('uses the next match even when the source is unordered', () => {
    expect(chooseAvailabilityMatch(matches, context)?.id).toBe('next')
  })
  it('honors the explicit match instead of a later match', () => {
    expect(chooseAvailabilityMatch(matches, { ...context, date: '2026-10-18', opponent: 'Hodge-Kamman' })?.id).toBe('next')
  })
  it('does not silently replace an unavailable explicit match', () => {
    expect(chooseAvailabilityMatch(matches, { ...context, date: '2026-10-25' })).toBeNull()
  })
  it('keeps a match manually selected by the captain', () => {
    expect(chooseAvailabilityMatch(matches, { ...context, selectedId: 'past', date: '2026-10-18' })?.id).toBe('past')
  })
})
