import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export type FollowEntityType = 'player' | 'team' | 'league'

export type FollowRecord = {
  entity_type: FollowEntityType
  entity_id: string
  entity_name: string
  subtitle?: string | null
}

export type FeedEventType = 'followed' | 'unfollowed'

const LOCAL_FOLLOW_KEY = 'tenaceiq:user_follows'
const LOCAL_FEED_KEY = 'tenaceiq:my_lab_feed'

function canUseWindow() {
  return typeof window !== 'undefined'
}

function readLocal<T>(key: string, fallback: T): T {
  if (!canUseWindow()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal<T>(key: string, value: T) {
  if (!canUseWindow()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

async function getCurrentUserId(): Promise<string | null> {
  const authState = await getClientAuthState()
  return authState.user?.id ?? null
}

export async function isFollowing(record: FollowRecord) {
  const userId = await getCurrentUserId()

  if (userId) {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('user_id', userId)
      .eq('entity_type', record.entity_type)
      .eq('entity_id', record.entity_id)
      .maybeSingle()

    if (!error) return Boolean(data)
  }

  const follows = readLocal<FollowRecord[]>(LOCAL_FOLLOW_KEY, [])
  return follows.some(
    (item) =>
      item.entity_type === record.entity_type &&
      item.entity_id === record.entity_id,
  )
}

export async function createFollow(record: FollowRecord) {
  const userId = await getCurrentUserId()

  if (userId) {
    const payload = {
      user_id: userId,
      entity_type: record.entity_type,
      entity_id: record.entity_id,
      entity_name: record.entity_name,
      subtitle: record.subtitle ?? null,
    }

    const insert = await supabase.from('user_follows').insert(payload)

    if (!insert.error) {
      await appendFeedEvent('followed', record)
      return
    }
  }

  const payload = {
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    entity_name: record.entity_name,
    subtitle: record.subtitle ?? null,
  }

  const follows = readLocal<FollowRecord[]>(LOCAL_FOLLOW_KEY, [])
  const exists = follows.some(
    (item) =>
      item.entity_type === record.entity_type &&
      item.entity_id === record.entity_id,
  )

  if (!exists) {
    writeLocal(LOCAL_FOLLOW_KEY, [payload, ...follows])
  }

  await appendFeedEvent('followed', record)
}

export async function removeFollow(record: FollowRecord) {
  const userId = await getCurrentUserId()

  if (userId) {
    const del = await supabase
      .from('user_follows')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', record.entity_type)
      .eq('entity_id', record.entity_id)

    if (!del.error) {
      await appendFeedEvent('unfollowed', record)
      return
    }
  }

  const follows = readLocal<FollowRecord[]>(LOCAL_FOLLOW_KEY, [])
  writeLocal(
    LOCAL_FOLLOW_KEY,
    follows.filter(
      (item) =>
        !(
          item.entity_type === record.entity_type &&
          item.entity_id === record.entity_id
        ),
    ),
  )

  await appendFeedEvent('unfollowed', record)
}

export async function appendFeedEvent(type: FeedEventType, record: FollowRecord) {
  const title =
    type === 'followed'
      ? `Following ${record.entity_name}`
      : `Unfollowed ${record.entity_name}`

  const body =
    type === 'followed'
      ? `Added ${record.entity_name} to My Lab${record.subtitle ? ` - ${record.subtitle}` : ''}`
      : `Removed ${record.entity_name} from My Lab`

  const payload = {
    event_type: type,
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    entity_name: record.entity_name,
    subtitle: record.subtitle ?? null,
    title,
    body,
    created_at: new Date().toISOString(),
  }

  const insert = await supabase.from('my_lab_feed').insert(payload)

  if (insert.error) {
    const feed = readLocal<typeof payload[]>(LOCAL_FEED_KEY, [])
    writeLocal(LOCAL_FEED_KEY, [payload, ...feed].slice(0, 100))
  }
}
