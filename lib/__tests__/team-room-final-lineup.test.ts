import { describe, expect, it } from 'vitest'
import {
  buildPublishedLineupChangeAnnouncement,
  buildTeamRoomFinalLineupReceipt,
  isTeamRoomFinalLineupSent,
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
