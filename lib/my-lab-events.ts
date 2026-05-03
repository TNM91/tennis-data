'use client'

import { supabase } from '@/lib/supabase'

const LOCAL_FEED_KEY = 'tenaceiq:my_lab_feed'

export type MyLabEntityType = 'player' | 'team' | 'league' | 'community'

export type MyLabEventPayload = {
  event_type: string
  entity_type: MyLabEntityType
  entity_id: string | null
  entity_name: string
  subtitle?: string | null
  title: string
  body?: string | null
  created_at?: string
}

function canUseWindow() {
  return typeof window !== 'undefined'
}

function readLocalFeed() {
  if (!canUseWindow()) return [] as MyLabEventPayload[]
  try {
    const raw = window.localStorage.getItem(LOCAL_FEED_KEY)
    return raw ? (JSON.parse(raw) as MyLabEventPayload[]) : []
  } catch {
    return []
  }
}

function writeLocalFeed(rows: MyLabEventPayload[]) {
  if (!canUseWindow()) return
  try {
    window.localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(rows))
  } catch {}
}

export async function appendMyLabEvents(events: MyLabEventPayload[]) {
  if (!events.length) return

  const normalized = events.map((event) => ({
    ...event,
    created_at: event.created_at || new Date().toISOString(),
  }))

  const insert = await supabase.from('my_lab_feed').insert(normalized)
  if (!insert.error) return

  const feed = readLocalFeed()
  writeLocalFeed([...normalized, ...feed].slice(0, 160))
}
