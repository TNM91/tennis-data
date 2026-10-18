import { describe, expect, it } from 'vitest'
import { buildCaptainLineupAnnouncement } from '@/lib/captain-lineup-announcement'

const lineup = { dateText: 'Oct 18', opponent: 'Hodge-Kamman', lineupText: 'D1: Alex / Jamie', location: 'Memorial Park', matchTime: '7:00 PM', arrivalTime: '6:30 PM' }

describe('captain lineup announcements', () => {
  it('distinguishes the scheduled start from the captain arrival time and includes the venue', () => {
    expect(buildCaptainLineupAnnouncement(lineup)).toBe('Lineup is set for Oct 18 vs Hodge-Kamman:\nD1: Alex / Jamie\nMatch time: 7:00 PM.\nLocation: Memorial Park\nArrive by 6:30 PM.')
  })

  it('uses the scheduled start when no earlier arrival time is set', () => {
    expect(buildCaptainLineupAnnouncement({ ...lineup, arrivalTime: ' ' })).toContain('Arrive by 7:00 PM.')
  })

  it('keeps unknown details out of the message without inventing a time or venue', () => {
    expect(buildCaptainLineupAnnouncement({ ...lineup, matchTime: null, location: '', arrivalTime: '' })).toBe('Lineup is set for Oct 18 vs Hodge-Kamman:\nD1: Alex / Jamie\nArrive by match time.')
  })
})
