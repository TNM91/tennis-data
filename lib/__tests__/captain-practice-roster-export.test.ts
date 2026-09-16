import { describe, expect, it } from 'vitest'
import { buildPracticeRosterExport } from '@/lib/captain-practice-roster-export'
import type { CaptainPracticeManagementOverview, CaptainPracticeRosterOverview } from '@/lib/internal-scheduling'

const event = {
  title: 'Aces practice',
  scheduledDate: '2026-09-20',
  scheduledTime: '9:30 AM',
  facility: 'Woodsmill Tennis Club',
} as CaptainPracticeManagementOverview['event']

const roster: CaptainPracticeRosterOverview = {
  publicToken: 'private-token',
  capacity: 3,
  roster: [
    { id: '1', playerName: 'Alex Ace', responseStatus: 'in', displayStatus: 'in', respondedAt: '', captainConfirmed: true, captainConfirmedAt: '2026-09-19T12:00:00Z' },
    { id: '2', playerName: '=SUM(1,2)', responseStatus: 'in', displayStatus: 'in', respondedAt: '', captainConfirmed: false, captainConfirmedAt: '' },
    { id: '3', playerName: 'Pat Player', responseStatus: 'in', displayStatus: 'waitlist', respondedAt: '', captainConfirmed: false, captainConfirmedAt: '' },
    { id: '4', playerName: 'Sam Smith', responseStatus: 'out', displayStatus: 'out', respondedAt: '', captainConfirmed: false, captainConfirmedAt: '' },
  ],
}

const createdAt = new Date('2026-09-19T18:00:00Z')

describe('practice roster exports', () => {
  it('shares only active signups with confirmation and waitlist status', () => {
    const result = buildPracticeRosterExport({ event, roster, kind: 'current', createdAt })
    expect(result.count).toBe(3)
    expect(result.text).toContain('Current practice roster')
    expect(result.text).toContain('Alex Ace — Confirmed')
    expect(result.text).toContain('Pat Player — Waitlisted · needs confirmation')
    expect(result.text).not.toContain('Sam Smith')
    expect(result.text).not.toContain('private-token')
    expect(result.csv).toContain('2026-09-19T18:00:00.000Z')
    expect(result.csv).toContain("'=SUM(1,2)")
    expect(result.filename).toBe('practice-roster-2026-09-20-current.csv')
  })

  it('keeps the confirmed snapshot to captain-confirmed players only', () => {
    const result = buildPracticeRosterExport({ event, roster, kind: 'confirmed', createdAt })
    expect(result.count).toBe(1)
    expect(result.text).toContain('Alex Ace — Confirmed')
    expect(result.text).not.toContain('Pat Player')
    expect(result.csv).not.toContain('=SUM(1,2)')
  })
})
