import { supabase } from '@/lib/supabase'

export type FollowEntityType = 'player' | 'team' | 'league'

export type FollowRecord = {
  entity_type: FollowEntityType
  entity_id: string
  entity_name: string
  subtitle?: string | null
}

export type FeedEventType = 'followed' | 'unfollowed'

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

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

async function mutateFollow(method: 'POST' | 'DELETE', record: FollowRecord) {
  const session = await getSession()
  if (!session) throw new Error('Sign in to manage follows.')
  const response = await fetch('/api/follows', {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.message || 'Could not save your follows.')
  }
}

export async function isFollowing(record: FollowRecord) {
  const userId = (await getSession())?.user.id

  if (userId) {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('user_id', userId)
      .eq('entity_type', record.entity_type)
      .eq('entity_id', record.entity_id)
      .limit(1)

    if (error) throw error
    return Boolean(data?.length)
  }
  return false
}

export async function createFollow(record: FollowRecord) {
  await mutateFollow('POST', record)
  await appendFeedEvent('followed', record)
}

export async function removeFollow(record: FollowRecord) {
  await mutateFollow('DELETE', record)
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
