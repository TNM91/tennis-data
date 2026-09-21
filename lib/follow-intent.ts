import type { FollowRecord } from './follow-feeds'

const KEY = 'tenaceiq:pending-follow-v1'
const MAX_AGE_MS = 60 * 60 * 1000

type FollowIntentStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type PendingFollowIntent = {
  entityType: FollowRecord['entity_type']
  entityId: string
  entityName?: string
  path: string
  userId: string | null
  createdAt: number
}

export function rememberFollowIntent(store: FollowIntentStore, record: FollowRecord, path: string, userId: string | null, now = Date.now()) {
  const intent: PendingFollowIntent = {
    entityType: record.entity_type,
    entityId: record.entity_id,
    entityName: record.entity_name.trim().slice(0, 120),
    path,
    userId,
    createdAt: now,
  }
  try {
    store.setItem(KEY, JSON.stringify(intent))
  } catch {
    // The return page still lets the member follow manually when storage is unavailable.
  }
}

export function peekFollowIntent(store: FollowIntentStore, path: string, userId: string | null, now = Date.now()) {
  const intent = readValidIntent(store, now)
  if (!intent || intent.path !== path || (intent.userId && intent.userId !== userId)) return null
  return {
    entityType: intent.entityType,
    entityName: typeof intent.entityName === 'string' ? intent.entityName.trim().slice(0, 80) : '',
  }
}

export function claimFollowIntentTracking(store: FollowIntentStore, path: string, userId: string, now = Date.now()) {
  const intent = readValidIntent(store, now)
  if (!intent || intent.path !== path) return null
  if (intent.userId && intent.userId !== userId) {
    try { store.removeItem(KEY) } catch {}
    return null
  }
  if (intent.userId) return null

  try {
    store.setItem(KEY, JSON.stringify({ ...intent, userId }))
    return intent.entityType
  } catch {
    return null
  }
}

export function takeFollowIntent(store: FollowIntentStore, record: FollowRecord, path: string, userId: string, now = Date.now()) {
  const intent = readValidIntent(store, now)
  if (!intent) return false
  if (intent.entityType !== record.entity_type || intent.entityId !== record.entity_id || intent.path !== path) return false
  if (intent.userId && intent.userId !== userId) {
    try { store.removeItem(KEY) } catch {}
    return false
  }
  try {
    store.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

function readValidIntent(store: FollowIntentStore, now: number): PendingFollowIntent | null {
  try {
    const raw = store.getItem(KEY)
    if (!raw) return null
    const intent = JSON.parse(raw) as Partial<PendingFollowIntent>
    if (
      typeof intent.createdAt !== 'number' || now < intent.createdAt || now - intent.createdAt > MAX_AGE_MS ||
      (intent.entityType !== 'player' && intent.entityType !== 'team' && intent.entityType !== 'league') ||
      typeof intent.entityId !== 'string' || typeof intent.path !== 'string'
    ) {
      store.removeItem(KEY)
      return null
    }
    return intent as PendingFollowIntent
  } catch {
    try { store.removeItem(KEY) } catch {}
    return null
  }
}
