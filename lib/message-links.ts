export type SupportMessageCategory = 'billing' | 'league' | 'result' | 'data' | 'account' | 'general'

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
  subject: string
  body?: string
  entityType?: string
  entityId?: string
}) {
  const params = new URLSearchParams({ compose: 'direct' })
  addParam(params, 'recipient', input.recipientName)
  addParam(params, 'subject', input.subject)
  addParam(params, 'body', input.body)
  addParam(params, 'entityType', input.entityType)
  addParam(params, 'entityId', input.entityId)
  return `/messages?${params.toString()}`
}
