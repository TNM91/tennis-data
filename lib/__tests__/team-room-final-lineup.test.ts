import { describe, expect, it } from 'vitest'
import {
  buildPublishedLineupChangeAnnouncement,
  buildTeamRoomFinalLineupReview,
  buildTeamRoomFinalLineupReceipt,
  getTeamRoomLineupAnnouncementStatus,
  isTeamRoomFinalLineupSent,
  readTeamRoomLineupAnnouncement,
  readTeamRoomFinalLineupReceipt,
} from '../team-room-final-lineup'

const receipt = buildTeamRoomFinalLineupReceipt({
  lineupId: ' lineup-locked:message-1:abc ',
  sourceMessageId: ' message-1 ',
  announcementMessageId: ' announcement-1 ',
  sentAt: ' 2026-08-05T14:00:00.000Z ',
  sentByUserId: ' captain-1 ',
  sentByName: ' Captain Casey ',
})

describe('Team Room final lineup receipt', () => {
  it('stores a clean shared receipt for the final announcement', () => {
    expect(receipt).toEqual({
      lineupId: 'lineup-locked:message-1:abc',
      sourceMessageId: 'message-1',
      announcementMessageId: 'announcement-1',
      sentAt: '2026-08-05T14:00:00.000Z',
      sentByUserId: 'captain-1',
      sentByName: 'Captain Casey',
    })
    expect(readTeamRoomFinalLineupReceipt(receipt)).toEqual(receipt)
    expect(isTeamRoomFinalLineupSent(receipt, receipt.lineupId)).toBe(true)
  })

  it('rejects incomplete receipts and other lineup versions', () => {
    expect(readTeamRoomFinalLineupReceipt({ lineupId: receipt.lineupId })).toBeNull()
    expect(isTeamRoomFinalLineupSent(receipt, 'lineup-locked:message-1:new')).toBe(false)
  })

  it('identifies current, superseded, and past lineup announcements', () => {
    expect(readTeamRoomLineupAnnouncement({
      finalLineupAnnouncement: true,
      sourceMessageId: 'match-1',
      lineupId: receipt.lineupId,
    })).toEqual({
      kind: 'final',
      sourceMessageId: 'match-1',
      lineupId: receipt.lineupId,
      previousFinalLineupId: '',
    })
    expect(readTeamRoomLineupAnnouncement({
      finalLineupChangeAnnouncement: true,
      sourceMessageId: 'match-1',
      previousFinalLineupId: receipt.lineupId,
    })?.kind).toBe('change')
    expect(getTeamRoomLineupAnnouncementStatus({
      announcementMessageId: receipt.announcementMessageId,
      sourceMessageId: 'match-1',
      currentReceipt: receipt,
      activeSourceMessageId: 'match-1',
    })).toBe('current')
    expect(getTeamRoomLineupAnnouncementStatus({
      announcementMessageId: 'announcement-pending',
      sourceMessageId: 'match-1',
      currentReceipt: null,
      activeSourceMessageId: 'match-1',
      pendingAnnouncementMessageId: 'announcement-pending',
    })).toBe('pending')
    expect(getTeamRoomLineupAnnouncementStatus({
      announcementMessageId: 'announcement-old',
      sourceMessageId: 'match-1',
      currentReceipt: receipt,
      activeSourceMessageId: 'match-1',
    })).toBe('superseded')
    expect(getTeamRoomLineupAnnouncementStatus({
      announcementMessageId: 'announcement-past',
      sourceMessageId: 'match-old',
      currentReceipt: receipt,
      activeSourceMessageId: 'match-1',
    })).toBe('past')
  })

  it('tracks only connected lineup players and treats the publisher as seen', () => {
    expect(buildTeamRoomFinalLineupReview({
      members: [
        { id: 'captain-1', name: 'Captain Casey', playerName: 'Casey Court' },
        { id: 'player-2', name: 'Alex A.', playerName: 'Alex Ace' },
        { id: 'player-3', name: 'Blair Ball' },
        { id: 'bench-1', name: 'Bench Player' },
      ],
      lineup: [
        { players: ['Casey Court', 'Alex Ace'] },
        { players: ['Blair Ball', 'Not Connected'] },
      ],
      seenProfileIds: ['player-2'],
      publisherUserId: 'captain-1',
      currentUserId: 'player-3',
    })).toEqual({
      requiredCount: 3,
      seenCount: 2,
      seenProfileIds: ['captain-1', 'player-2'],
      unseenProfileIds: ['player-3'],
      unseenNames: ['Blair Ball'],
      currentUserRequired: true,
      currentUserSeen: false,
    })
  })

  it('builds one concise published-lineup change for the affected court', () => {
    expect(buildPublishedLineupChangeAnnouncement({
      courtLabel: '4.0 Doubles',
      outgoingPlayerName: 'Alex Ace',
      replacementPlayerName: 'Blair Ball',
      afterPlayers: ['Blair Ball', 'Casey Court'],
      matchDate: '2026-08-12',
      opponent: 'Net Results',
    })).toBe([
      'Final lineup changed — 2026-08-12 vs Net Results',
      '4.0 Doubles: Blair Ball / Casey Court',
      'Blair Ball replaces Alex Ace.',
      'Blair Ball, please confirm this court.',
    ].join('\n'))
  })
})
