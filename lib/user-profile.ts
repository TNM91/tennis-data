'use client'

import { supabase } from '@/lib/supabase'
import {
  isMissingProfileLinkSchemaError,
  readLocalProfileLink,
  writeLocalProfileLink,
  type StoredProfileLink,
} from '@/lib/profile-link-storage'

export type UserProfileLink = {
  linked_player_id: string | null
  linked_player_name: string | null
  linked_team_name: string | null
  linked_league_name: string | null
  linked_flight?: string | null
}

export type SaveUserProfileLinkPayload = UserProfileLink & {
  linked_team_at: string
}

export type LoadUserProfileLinkResult = {
  data: UserProfileLink | null
  error: Error | null
  source: 'cloud' | 'local' | 'none'
  cloudSchemaReady: boolean
}

export type SaveUserProfileLinkResult = {
  data: UserProfileLink
  error: Error | null
  source: 'cloud' | 'local'
  cloudSchemaReady: boolean
}

function normalizeStoredProfileLink(value: StoredProfileLink | null): UserProfileLink | null {
  if (!value) return null
  return {
    linked_player_id: value.linked_player_id || null,
    linked_player_name: value.linked_player_name || null,
    linked_team_name: value.linked_team_name || null,
    linked_league_name: value.linked_league_name || null,
    linked_flight: value.linked_flight || null,
  }
}

function toError(message: string) {
  return new Error(message)
}

export async function loadUserProfileLink(userId: string | null | undefined): Promise<LoadUserProfileLinkResult> {
  if (!userId) {
    return { data: null, error: null, source: 'none', cloudSchemaReady: true }
  }

  const fullRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight')
    .eq('id', userId)
    .maybeSingle()

  if (!fullRes.error) {
    return {
      data: (fullRes.data || null) as UserProfileLink | null,
      error: null,
      source: fullRes.data ? 'cloud' : 'none',
      cloudSchemaReady: true,
    }
  }

  if (!isMissingProfileLinkSchemaError(fullRes.error.message)) {
    return {
      data: null,
      error: toError(fullRes.error.message),
      source: 'none',
      cloudSchemaReady: true,
    }
  }

  const fallbackRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name')
    .eq('id', userId)
    .maybeSingle()

  if (!fallbackRes.error) {
    return {
      data: (fallbackRes.data || null) as UserProfileLink | null,
      error: null,
      source: fallbackRes.data ? 'cloud' : 'none',
      cloudSchemaReady: false,
    }
  }

  if (!isMissingProfileLinkSchemaError(fallbackRes.error.message)) {
    return {
      data: null,
      error: toError(fallbackRes.error.message),
      source: 'none',
      cloudSchemaReady: false,
    }
  }

  const localLink = normalizeStoredProfileLink(readLocalProfileLink(userId))
  return {
    data: localLink,
    error: null,
    source: localLink ? 'local' : 'none',
    cloudSchemaReady: false,
  }
}

export async function saveUserProfileLink(
  userId: string,
  payload: SaveUserProfileLinkPayload,
): Promise<SaveUserProfileLinkResult> {
  const fullUpdate = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)

  if (!fullUpdate.error) {
    return {
      data: payload,
      error: null,
      source: 'cloud',
      cloudSchemaReady: true,
    }
  }

  if (!isMissingProfileLinkSchemaError(fullUpdate.error.message)) {
    return {
      data: payload,
      error: toError(fullUpdate.error.message),
      source: 'cloud',
      cloudSchemaReady: true,
    }
  }

  const fallbackPayload = { ...payload }
  delete fallbackPayload.linked_flight

  const fallbackUpdate = await supabase
    .from('profiles')
    .update(fallbackPayload)
    .eq('id', userId)

  if (!fallbackUpdate.error) {
    return {
      data: payload,
      error: null,
      source: 'cloud',
      cloudSchemaReady: false,
    }
  }

  if (!isMissingProfileLinkSchemaError(fallbackUpdate.error.message)) {
    return {
      data: payload,
      error: toError(fallbackUpdate.error.message),
      source: 'cloud',
      cloudSchemaReady: false,
    }
  }

  writeLocalProfileLink(userId, payload)
  return {
    data: payload,
    error: null,
    source: 'local',
    cloudSchemaReady: false,
  }
}
