import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCaptainReplyNotification,
  findCaptainReplyCourt,
  parseCaptainReplyAlert,
  selectCaptainReplyAlerts,
} from '../captain-reply-alert'

describe('captain reply alerts', () => {
  it('builds a direct, scoped Captain notification', () => {
    const notification = buildCaptainReplyNotification({
      playerName: 'Alex Ace',
      status: 'unavailable',
      teamName: 'Net Results',
      leagueName: 'USTA 4.0',
      flight: 'A',
      matchDate: '2026-08-12',
      opponentTeam: 'Court Kings',
    })

    expect(notification.title).toBe('Alex Ace replied Out')
    expect(notification.body).toContain('Review availability before setting the lineup.')
    expect(notification.href).toContain('notice=captain-availability-reply')
    expect(notification.href).toContain('status=unavailable')
    expect(notification.href).toContain('#captain-reply-alert')
  })

  it('opens the exact Team Chat card and carries the projected court', () => {
    const courtLabel = findCaptainReplyCourt([
      { label: '4.5 Doubles', players: [{ playerId: 'player-1', playerName: 'Alex Ace' }, { playerName: 'Jordan Jam' }] },
      { label: '4.0 Doubles', players: ['Casey Court', 'Taylor Tennis'] },
    ], { playerId: 'player-1', playerName: 'Alex Ace' })
    const notification = buildCaptainReplyNotification({
      playerName: 'Alex Ace',
      status: 'unavailable',
      teamName: 'Net Results',
      leagueName: 'USTA 4.0',
      flight: 'A',
      matchDate: '2026-08-12',
      opponentTeam: 'Court Kings',
      teamRoomMessageId: 'message-123',
      availabilityRequestId: 'request-456',
      courtLabel,
    })

    expect(courtLabel).toBe('4.5 Doubles')
    expect(notification.body).toContain('4.5 Doubles')
    expect(notification.href).toContain('/team-room?')
    expect(notification.href).toContain('message=message-123')
    expect(notification.href).toContain('court=4.5+Doubles')
    expect(notification.href).toContain('#match-card-message-123')
  })

  it('parses current and legacy availability notifications', () => {
    const current = buildCaptainReplyNotification({
      playerName: 'Alex Ace',
      status: 'available',
      teamName: 'Net Results',
      matchDate: '2026-08-12',
    })
    const parsedCurrent = parseCaptainReplyAlert({ id: 'current', createdAt: '2026-08-01T12:00:00Z', ...current })
    const parsedLegacy = parseCaptainReplyAlert({
      id: 'legacy',
      title: 'Availability updated',
      body: 'Casey Court: Maybe for 2026-08-12.',
      href: '/captain/messaging?team=Net+Results&date=2026-08-12',
      createdAt: '2026-08-01T11:00:00Z',
    })

    expect(parsedCurrent).toMatchObject({ playerName: 'Alex Ace', statusLabel: 'In' })
    expect(parsedLegacy).toMatchObject({ playerName: 'Casey Court', statusLabel: 'Maybe' })
  })

  it('keeps only unread reply alerts for the selected team and match', () => {
    const first = buildCaptainReplyNotification({ playerName: 'Alex Ace', status: 'available', teamName: 'Net Results', matchDate: '2026-08-12' })
    const second = buildCaptainReplyNotification({ playerName: 'Casey Court', status: 'maybe', teamName: 'Other Team', matchDate: '2026-08-12' })
    const alerts = selectCaptainReplyAlerts([
      { id: 'first', createdAt: '2026-08-01T12:00:00Z', ...first },
      { id: 'second', createdAt: '2026-08-01T13:00:00Z', ...second },
    ], { teamName: 'Net Results', matchDate: '2026-08-12' })

    expect(alerts.map((alert) => alert.playerName)).toEqual(['Alex Ace'])
  })

  it('connects Captain Home and Messages to durable notification read state', () => {
    const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
    const messagesSource = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')
    const routeSource = readFileSync(join(process.cwd(), 'app/api/captain/availability-requests/[token]/route.ts'), 'utf8')

    expect(captainSource).toContain('listInternalNotifications(userId, { unreadOnly: true')
    expect(captainSource).toContain('markInternalNotificationRead(notification.id, userId)')
    expect(captainSource).toContain('New availability reply')
    expect(captainSource).toContain('Review affected lineup')
    expect(captainSource).toContain('captainReplyAlertHref')
    expect(messagesSource).toContain('router.push(notification.href)')
    expect(routeSource).toContain('buildCaptainReplyNotification({')
    expect(routeSource).toContain('findTeamRoomAvailabilityCard')
    expect(routeSource).toContain('sendTeamRoomPush(service, recipients')
  })
})
