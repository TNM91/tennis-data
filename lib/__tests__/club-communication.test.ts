import { describe, expect, it } from 'vitest'
import { getClubCommunicationAttentionItems, getClubCommunicationSummary, type ClubCommunicationItem } from '../club-communication'

const item = (overrides: Partial<ClubCommunicationItem>): ClubCommunicationItem => ({
  id: 'team:one',
  channelId: 'one',
  channelType: 'team',
  channelName: '4.0 Team',
  href: '/team-room?team=4.0+Team',
  authorName: 'Player One',
  body: 'Can I play court two?',
  activityType: 'message',
  createdAt: '2026-08-08T18:00:00.000Z',
  unreadCount: 0,
  needsReply: false,
  ...overrides,
})

describe('Club communication follow-up', () => {
  it('counts unread activity separately from conversations needing a reply', () => {
    const summary = getClubCommunicationSummary([
      item({ unreadCount: 2, needsReply: true }),
      item({ id: 'clinic:two', channelId: 'two', channelType: 'clinic', unreadCount: 1 }),
      item({ id: 'team:three', channelId: 'three' }),
    ])

    expect(summary).toEqual({ unreadCount: 3, needsReplyCount: 1, attentionCount: 2 })
  })

  it('keeps inbound replies in attention order before older unread updates', () => {
    const attention = getClubCommunicationAttentionItems([
      item({ id: 'clinic:older', channelId: 'older', channelType: 'clinic', unreadCount: 1, createdAt: '2026-08-08T17:00:00.000Z' }),
      item({ id: 'team:newer', channelId: 'newer', needsReply: true, createdAt: '2026-08-08T19:00:00.000Z' }),
      item({ id: 'team:done', channelId: 'done', createdAt: '2026-08-08T20:00:00.000Z' }),
    ])

    expect(attention.map((entry) => entry.id)).toEqual(['team:newer', 'clinic:older'])
  })
})
