export type SupportMessageCategory = 'billing' | 'league' | 'result' | 'data' | 'account' | 'general'

export const SUPPORT_THREAD_ASSURANCE =
  'Support threads stay inside TenAceIQ Messages so billing, data, league, and account questions can be tracked by admins without relying on external email.'

function addParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const cleanValue = (value || '').trim()
  if (cleanValue) params.set(key, cleanValue)
}

export function buildSupportMessageHref(input: {
  category?: SupportMessageCategory
  subject: string
  body?: string
  entityType?: string
  entityId?: string
}) {
  const params = new URLSearchParams({ compose: 'support' })
  addParam(params, 'category', input.category || 'general')
  addParam(params, 'subject', input.subject)
  addParam(params, 'body', input.body)
  addParam(params, 'entityType', input.entityType)
  addParam(params, 'entityId', input.entityId)
  return `/messages?${params.toString()}`
}

export function buildDirectMessageHref(input: {
  recipientName?: string
  recipientProfileId?: string
  recipientPlayerId?: string
  subject: string
  body?: string
  entityType?: string
  entityId?: string
}) {
  const params = new URLSearchParams({ compose: 'direct' })
  addParam(params, 'recipient', input.recipientName)
  addParam(params, 'recipientProfileId', input.recipientProfileId)
  addParam(params, 'recipientPlayerId', input.recipientPlayerId)
  addParam(params, 'subject', input.subject)
  addParam(params, 'body', input.body)
  addParam(params, 'entityType', input.entityType)
  addParam(params, 'entityId', input.entityId)
  return `/messages?${params.toString()}`
}
