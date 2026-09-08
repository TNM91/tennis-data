import { describe, expect, it } from 'vitest'
import { reconcileCaptainCloudAvailability, reconcileCaptainGuestAvailability } from '../captain-availability-reconciliation'

const contacts = [
  { id: 'sam', full_name: 'Sam Edwards' },
  { id: 'joel', full_name: 'Joel Pottebaum' },
]

describe('captain guest availability reconciliation', () => {
  it('adds guest replies to full-roster availability', () => {
    const result = reconcileCaptainGuestAvailability({
      eventKey: 'match-week',
      contacts,
      rows: [],
      replies: [
        { player_name: ' Sam   Edwards ', status: 'available', responded_at: '2026-09-08T18:00:00.000Z' },
        { player_name: 'Joel Pottebaum', status: 'maybe', responded_at: '2026-09-08T18:01:00.000Z' },
      ],
    })

    expect(result.changed).toBe(true)
    expect(result.matchedReplies).toBe(2)
    expect(result.updates).toHaveLength(2)
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ contact_id: 'sam', status: 'available' }),
      expect.objectContaining({ contact_id: 'joel', status: 'tentative' }),
    ]))
  })

  it('updates an older status when the player changes their reply', () => {
    const result = reconcileCaptainGuestAvailability({
      eventKey: 'match-week',
      contacts,
      rows: [{
        id: 'saved-sam',
        event_key: 'match-week',
        contact_id: 'sam',
        status: 'tentative',
        note: '',
        updated_at: '2026-09-08T17:00:00.000Z',
      }],
      replies: [{ player_name: 'Sam Edwards', status: 'available', responded_at: '2026-09-08T18:00:00.000Z' }],
    })

    expect(result.rows).toContainEqual(expect.objectContaining({ id: 'saved-sam', status: 'available' }))
  })

  it('preserves a newer captain-entered status', () => {
    const rows = [{
      id: 'saved-sam',
      event_key: 'match-week',
      contact_id: 'sam',
      status: 'unavailable' as const,
      note: 'Captain confirmed by phone',
      updated_at: '2026-09-08T19:00:00.000Z',
    }]
    const result = reconcileCaptainGuestAvailability({
      eventKey: 'match-week',
      contacts,
      rows,
      replies: [{ player_name: 'Sam Edwards', status: 'available', responded_at: '2026-09-08T18:00:00.000Z' }],
    })

    expect(result.changed).toBe(false)
    expect(result.rows).toBe(rows)
  })

  it('ignores replies that do not match the selected roster', () => {
    const result = reconcileCaptainGuestAvailability({
      eventKey: 'match-week',
      contacts,
      rows: [],
      replies: [{ player_name: 'Other Team Player', status: 'available', responded_at: '2026-09-08T18:00:00.000Z' }],
    })

    expect(result.changed).toBe(false)
    expect(result.matchedReplies).toBe(0)
  })
})

describe('captain cloud availability reconciliation', () => {
  it('uses a newer cloud status on another device', () => {
    const result = reconcileCaptainCloudAvailability({
      eventKey: 'match-week',
      contacts,
      rows: [{
        id: 'saved-sam', event_key: 'match-week', contact_id: 'sam', status: 'tentative', note: '',
        updated_at: '2026-09-08T17:00:00.000Z',
      }],
      cloudRows: [{
        playerName: 'Sam Edwards', status: 'available', note: 'Updated by captain',
        updatedAt: '2026-09-08T18:00:00.000Z',
      }],
    })

    expect(result.rows).toContainEqual(expect.objectContaining({ contact_id: 'sam', status: 'available' }))
    expect(result.uploads).toEqual([])
  })

  it('queues a newer phone status for one-time cloud migration', () => {
    const result = reconcileCaptainCloudAvailability({
      eventKey: 'match-week',
      contacts,
      rows: [{
        id: 'saved-sam', event_key: 'match-week', contact_id: 'sam', status: 'unavailable', note: 'Called me',
        updated_at: '2026-09-08T19:00:00.000Z',
      }],
      cloudRows: [{
        playerName: 'Sam Edwards', status: 'available', note: '',
        updatedAt: '2026-09-08T18:00:00.000Z',
      }],
    })

    expect(result.changed).toBe(false)
    expect(result.uploads).toEqual([expect.objectContaining({ playerName: 'Sam Edwards', status: 'unavailable' })])
  })

  it('does not move another match week into the selected match', () => {
    const rows = [{
      id: 'other-week', event_key: 'other-week', contact_id: 'sam', status: 'available' as const, note: '',
      updated_at: '2026-09-08T19:00:00.000Z',
    }]
    const result = reconcileCaptainCloudAvailability({ eventKey: 'match-week', contacts, rows, cloudRows: [] })

    expect(result.rows).toBe(rows)
    expect(result.uploads).toEqual([])
  })
})
