import { describe, expect, it, vi } from 'vitest'
import {
  buildCoachInvitePayload,
  canAcceptCoachInviteEmail,
  isCoachInviteExpired,
  mapCoachInviteRow,
  normalizeCoachInviteStatus,
} from '../coach-invites'

describe('coach invites', () => {
  it('normalizes invite statuses', () => {
    expect(normalizeCoachInviteStatus('accepted')).toBe('accepted')
    expect(normalizeCoachInviteStatus('mystery')).toBe('pending')
  })

  it('builds coach-owned invite payloads', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('invite-id')
      .mockReturnValueOnce('token-id')

    expect(
      buildCoachInvitePayload(
        {
          studentLinkId: 'student-1',
          inviteEmail: ' PLAYER@EXAMPLE.COM ',
          message: 'Join my coach workspace',
        },
        'coach-1',
      ),
    ).toMatchObject({
      id: 'coach-invite-invite-id',
      coach_user_id: 'coach-1',
      student_link_id: 'student-1',
      invite_email: 'player@example.com',
      invite_token: 'token-id',
      status: 'pending',
      message: 'Join my coach workspace',
    })
  })

  it('maps rows to shareable invite links', () => {
    expect(
      mapCoachInviteRow(
        {
          id: 'invite-1',
          student_link_id: 'student-1',
          invite_email: 'player@example.com',
          invite_token: 'token-1',
          status: 'pending',
          message: '',
          expires_at: null,
          updated_at: '2026-05-28T12:00:00.000Z',
        },
        'https://tenaceiq.com',
      ),
    ).toMatchObject({
      inviteHref: 'https://tenaceiq.com/coach/invite/token-1',
      inviteToken: 'token-1',
      status: 'pending',
    })
  })

  it('checks email-restricted invite acceptance', () => {
    expect(canAcceptCoachInviteEmail('', 'player@example.com')).toBe(true)
    expect(canAcceptCoachInviteEmail(' PLAYER@EXAMPLE.COM ', 'player@example.com')).toBe(true)
    expect(canAcceptCoachInviteEmail('player@example.com', 'other@example.com')).toBe(false)
    expect(canAcceptCoachInviteEmail('player@example.com', null)).toBe(false)
  })

  it('detects expired invites without treating blank expirations as expired', () => {
    const now = Date.parse('2026-05-28T12:00:00.000Z')
    expect(isCoachInviteExpired(null, now)).toBe(false)
    expect(isCoachInviteExpired('2026-05-28T11:59:59.000Z', now)).toBe(true)
    expect(isCoachInviteExpired('2026-05-28T12:00:01.000Z', now)).toBe(false)
  })
})
