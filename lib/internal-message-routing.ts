import type { UserRole } from './roles'

export type InternalSupportRoutingConversationType = 'direct' | 'support' | 'league' | 'system' | string | null | undefined
export type InternalSupportRoutingStatus = 'open' | 'waiting_on_user' | 'waiting_on_admin' | 'closed'

type SupportReplyRoutingInput = {
  conversationType: InternalSupportRoutingConversationType
  senderRole: UserRole
  skipSupportAutoStatus?: boolean
}

function normalizeConversationType(value: InternalSupportRoutingConversationType) {
  if (value === 'support' || value === 'league' || value === 'system') return value
  return 'direct'
}

export function getSupportReplyStatus(input: SupportReplyRoutingInput): InternalSupportRoutingStatus | null {
  if (input.skipSupportAutoStatus || normalizeConversationType(input.conversationType) !== 'support') return null
  return input.senderRole === 'admin' ? 'waiting_on_user' : 'waiting_on_admin'
}

export function shouldNotifySupportAdminsForReply(input: SupportReplyRoutingInput & {
  skipSupportAdminNotification?: boolean
}) {
  return (
    !input.skipSupportAdminNotification &&
    normalizeConversationType(input.conversationType) === 'support' &&
    input.senderRole !== 'admin'
  )
}
