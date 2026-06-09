import { describe, expect, it } from 'vitest'
import { getSupportReplyStatus, shouldNotifySupportAdminsForReply } from '../internal-message-routing'

describe('internal message support routing', () => {
  it('moves support replies to the side that owes the next response', () => {
    expect(getSupportReplyStatus({
      conversationType: 'support',
      senderRole: 'member',
    })).toBe('waiting_on_admin')

    expect(getSupportReplyStatus({
      conversationType: 'support',
      senderRole: 'admin',
    })).toBe('waiting_on_user')
  })

  it('does not change status for non-support threads or explicit ops updates', () => {
    expect(getSupportReplyStatus({
      conversationType: 'direct',
      senderRole: 'member',
    })).toBeNull()

    expect(getSupportReplyStatus({
      conversationType: 'support',
      senderRole: 'admin',
      skipSupportAutoStatus: true,
    })).toBeNull()
  })

  it('routes user support replies back to admins without alerting admins on admin replies', () => {
    expect(shouldNotifySupportAdminsForReply({
      conversationType: 'support',
      senderRole: 'member',
    })).toBe(true)

    expect(shouldNotifySupportAdminsForReply({
      conversationType: 'support',
      senderRole: 'admin',
    })).toBe(false)

    expect(shouldNotifySupportAdminsForReply({
      conversationType: 'support',
      senderRole: 'member',
      skipSupportAdminNotification: true,
    })).toBe(false)
  })
})
