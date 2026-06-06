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
  profile_photo_url?: string | null
  message_display_name?: string | null
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

export type SyncUserProfileLinkToCloudResult = SaveUserProfileLinkResult & {
  via: 'api' | 'supabase'
}

type ProfileLinkApiResponse = {
  ok?: boolean
  message?: string
  profile?: UserProfileLink | null
}

type ProfileLinkAuthSession = {
  access_token?: string
  user?: { id?: string }
} | null

function normalizeStoredProfileLink(value: StoredProfileLink | null): UserProfileLink | null {
  if (!value) return null
  return {
    linked_player_id: value.linked_player_id || null,
    linked_player_name: value.linked_player_name || null,
    linked_team_name: value.linked_team_name || null,
    linked_league_name: value.linked_league_name || null,
    linked_flight: value.linked_flight || null,
    message_display_name: null,
  }
}

function toError(message: string) {
  return new Error(message)
}

function hasProfileLinkData(value: UserProfileLink | null | undefined) {
  return Boolean(
    value?.linked_player_id ||
      value?.linked_player_name ||
      value?.linked_team_name ||
      value?.linked_league_name ||
      value?.linked_flight ||
      value?.profile_photo_url ||
      value?.message_display_name,
  )
}

function hasLinkedIdentityData(value: UserProfileLink | null | undefined) {
  return Boolean(
    value?.linked_player_id ||
      value?.linked_player_name ||
      value?.linked_team_name ||
      value?.linked_league_name ||
      value?.linked_flight,
  )
}

function mergeCloudAndLocalProfileLink(cloudData: UserProfileLink | null, localLink: UserProfileLink | null) {
  if (!cloudData && !localLink) return null
  return {
    linked_player_id: cloudData?.linked_player_id || localLink?.linked_player_id || null,
    linked_player_name: cloudData?.linked_player_name || localLink?.linked_player_name || null,
    linked_team_name: cloudData?.linked_team_name || localLink?.linked_team_name || null,
    linked_league_name: cloudData?.linked_league_name || localLink?.linked_league_name || null,
    linked_flight: cloudData?.linked_flight || localLink?.linked_flight || null,
    profile_photo_url: cloudData?.profile_photo_url || localLink?.profile_photo_url || null,
    message_display_name: cloudData?.message_display_name || localLink?.message_display_name || null,
  }
}

function buildSaveProfileLinkPayload(
  link: UserProfileLink,
  linkedAt = new Date().toISOString(),
): SaveUserProfileLinkPayload {
  return {
    linked_player_id: link.linked_player_id || null,
    linked_player_name: link.linked_player_name || null,
    linked_team_name: link.linked_team_name || null,
    linked_league_name: link.linked_league_name || null,
    linked_flight: link.linked_flight || null,
    linked_team_at: linkedAt,
    profile_photo_url: link.profile_photo_url || null,
    message_display_name: link.message_display_name || link.linked_player_name || null,
  }
}

async function getProfileLinkAuthSession(userId: string): Promise<ProfileLinkAuthSession> {
  const auth = supabase.auth as
    | {
        getSession?: () => Promise<{
          data: { session: ProfileLinkAuthSession }
        }>
      }
    | undefined
  const {
    data: { session },
  } = await auth?.getSession?.() ?? { data: { session: null } }

  if (!session?.access_token || session.user?.id !== userId) return null
  return session
}

async function syncLocalProfileLinkToCloudViaApi(userId: string, localLink: UserProfileLink | null) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null
  if (!localLink || !hasLinkedIdentityData(localLink)) return null

  try {
    const session = await getProfileLinkAuthSession(userId)
    if (!session?.access_token) return null

    const response = await window.fetch('/api/profile/link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        localLink.linked_player_id
          ? { linkedPlayerId: localLink.linked_player_id }
          : { playerName: localLink.linked_player_name },
      ),
    })
    const body = (await response.json().catch(() => null)) as ProfileLinkApiResponse | null

    if (!response.ok || !body?.ok || !body.profile) return null
    return body.profile
  } catch {
    return null
  }
}

export async function syncUserProfileLinkToCloud(
  userId: string,
  localLink: UserProfileLink | null,
): Promise<SyncUserProfileLinkToCloudResult> {
  if (!localLink || !hasLinkedIdentityData(localLink)) {
    return {
      data: buildSaveProfileLinkPayload({
        linked_player_id: null,
        linked_player_name: null,
        linked_team_name: null,
        linked_league_name: null,
      }),
      error: toError('Choose or save your player before syncing to cloud.'),
      source: 'local',
      cloudSchemaReady: true,
      via: 'supabase',
    }
  }

  const linkedAt = new Date().toISOString()
  const apiProfile = await syncLocalProfileLinkToCloudViaApi(userId, localLink)
  if (apiProfile) {
    const data = mergeCloudAndLocalProfileLink(apiProfile, localLink) ?? apiProfile
    writeLocalProfileLink(userId, buildSaveProfileLinkPayload(data, linkedAt))

    return {
      data,
      error: null,
      source: 'cloud',
      cloudSchemaReady: true,
      via: 'api',
    }
  }

  const fallbackResult = await saveUserProfileLink(userId, buildSaveProfileLinkPayload(localLink, linkedAt))
  return {
    ...fallbackResult,
    via: 'supabase',
  }
}

async function syncLocalProfileLinkToCloud(userId: string, localLink: UserProfileLink | null) {
  if (!localLink || !hasLinkedIdentityData(localLink)) return
  try {
    await syncUserProfileLinkToCloud(userId, localLink)
  } catch {
    // Loading should never fail because a best-effort persistence repair failed.
  }
}

async function loadUserProfileLinkFromApi(userId: string): Promise<LoadUserProfileLinkResult | null> {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null

  try {
    const session = await getProfileLinkAuthSession(userId)
    if (!session?.access_token || session.user?.id !== userId) return null

    const response = await window.fetch('/api/profile/link', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const body = (await response.json().catch(() => null)) as ProfileLinkApiResponse | null

    if (!response.ok || !body?.ok) {
      return {
        data: null,
        error: body?.message ? toError(body.message) : toError('Unable to load your player profile.'),
        source: 'none',
        cloudSchemaReady: true,
      }
    }

    return {
      data: body.profile ?? null,
      error: null,
      source: hasProfileLinkData(body.profile) ? 'cloud' : 'none',
      cloudSchemaReady: true,
    }
  } catch {
    return null
  }
}

export async function loadUserProfileLink(userId: string | null | undefined): Promise<LoadUserProfileLinkResult> {
  if (!userId) {
    return { data: null, error: null, source: 'none', cloudSchemaReady: true }
  }

  const localLink = normalizeStoredProfileLink(readLocalProfileLink(userId))
  const apiRes = await loadUserProfileLinkFromApi(userId)

  if (apiRes && !apiRes.error) {
    const data = mergeCloudAndLocalProfileLink(apiRes.data, localLink)
    if (!hasLinkedIdentityData(apiRes.data) && hasLinkedIdentityData(localLink)) {
      void syncLocalProfileLinkToCloud(userId, localLink)
    }
    return {
      ...apiRes,
      data,
      source: hasLinkedIdentityData(apiRes.data) || (hasProfileLinkData(apiRes.data) && !localLink) ? 'cloud' : localLink ? 'local' : 'none',
    }
  }

  const fullRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight,profile_photo_url,message_display_name')
    .eq('id', userId)
    .maybeSingle()

  if (!fullRes.error) {
    const cloudData = (fullRes.data || null) as UserProfileLink | null
    const data = mergeCloudAndLocalProfileLink(cloudData, localLink)
    if (!hasLinkedIdentityData(cloudData) && hasLinkedIdentityData(localLink)) {
      void syncLocalProfileLinkToCloud(userId, localLink)
    }
    return {
      data,
      error: null,
      source: hasLinkedIdentityData(cloudData) || (hasProfileLinkData(cloudData) && !localLink) ? 'cloud' : localLink ? 'local' : 'none',
      cloudSchemaReady: true,
    }
  }

  if (!isMissingProfileLinkSchemaError(fullRes.error.message)) {
    return {
      data: localLink,
      error: toError(fullRes.error.message),
      source: localLink ? 'local' : 'none',
      cloudSchemaReady: true,
    }
  }

  const fallbackRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name,profile_photo_url,message_display_name')
    .eq('id', userId)
    .maybeSingle()

  if (!fallbackRes.error) {
    const cloudData = (fallbackRes.data || null) as UserProfileLink | null
    const data = mergeCloudAndLocalProfileLink(cloudData, localLink)
    if (!hasLinkedIdentityData(cloudData) && hasLinkedIdentityData(localLink)) {
      void syncLocalProfileLinkToCloud(userId, localLink)
    }
    return {
      data,
      error: null,
      source: hasLinkedIdentityData(cloudData) || (hasProfileLinkData(cloudData) && !localLink) ? 'cloud' : localLink ? 'local' : 'none',
      cloudSchemaReady: false,
    }
  }

  if (!isMissingProfileLinkSchemaError(fallbackRes.error.message)) {
    return {
      data: localLink,
      error: toError(fallbackRes.error.message),
      source: localLink ? 'local' : 'none',
      cloudSchemaReady: false,
    }
  }

  const minimalRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name')
    .eq('id', userId)
    .maybeSingle()

  if (!minimalRes.error) {
    const cloudData = (minimalRes.data || null) as UserProfileLink | null
    const data = mergeCloudAndLocalProfileLink(cloudData, localLink)
    if (!hasLinkedIdentityData(cloudData) && hasLinkedIdentityData(localLink)) {
      void syncLocalProfileLinkToCloud(userId, localLink)
    }
    return {
      data,
      error: null,
      source: hasLinkedIdentityData(cloudData) || (hasProfileLinkData(cloudData) && !localLink) ? 'cloud' : localLink ? 'local' : 'none',
      cloudSchemaReady: false,
    }
  }

  if (!isMissingProfileLinkSchemaError(minimalRes.error.message)) {
    return {
      data: localLink,
      error: toError(minimalRes.error.message),
      source: localLink ? 'local' : 'none',
      cloudSchemaReady: false,
    }
  }

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
  writeLocalProfileLink(userId, payload)

  const fullPayload = { id: userId, ...payload }
  const fullUpdate = await supabase
    .from('profiles')
    .upsert(fullPayload, { onConflict: 'id' })
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight,profile_photo_url,message_display_name')
    .maybeSingle()

  if (!fullUpdate.error) {
    return {
      data: (fullUpdate.data || payload) as UserProfileLink,
      error: null,
      source: 'cloud',
      cloudSchemaReady: true,
    }
  }

  if (!isMissingProfileLinkSchemaError(fullUpdate.error.message)) {
    return {
      data: payload,
      error: toError(fullUpdate.error.message),
      source: 'local',
      cloudSchemaReady: true,
    }
  }

  const fallbackPayload = {
    id: userId,
    linked_player_id: payload.linked_player_id,
    linked_player_name: payload.linked_player_name,
    message_display_name: payload.message_display_name || payload.linked_player_name,
  }

  const fallbackUpdate = await supabase
    .from('profiles')
    .upsert(fallbackPayload, { onConflict: 'id' })
    .select('linked_player_id,linked_player_name,profile_photo_url,message_display_name')
    .maybeSingle()

  if (!fallbackUpdate.error) {
    return {
      data: (fallbackUpdate.data || payload) as UserProfileLink,
      error: null,
      source: 'cloud',
      cloudSchemaReady: false,
    }
  }

  if (!isMissingProfileLinkSchemaError(fallbackUpdate.error.message)) {
    return {
      data: payload,
      error: toError(fallbackUpdate.error.message),
      source: 'local',
      cloudSchemaReady: false,
    }
  }

  const minimalPayload = {
    id: userId,
    linked_player_id: payload.linked_player_id,
    linked_player_name: payload.linked_player_name,
  }
  const minimalUpdate = await supabase
    .from('profiles')
    .upsert(minimalPayload, { onConflict: 'id' })
    .select('linked_player_id,linked_player_name')
    .maybeSingle()

  if (!minimalUpdate.error) {
    return {
      data: (minimalUpdate.data || payload) as UserProfileLink,
      error: null,
      source: 'cloud',
      cloudSchemaReady: false,
    }
  }

  if (!isMissingProfileLinkSchemaError(minimalUpdate.error.message)) {
    return {
      data: payload,
      error: toError(minimalUpdate.error.message),
      source: 'local',
      cloudSchemaReady: false,
    }
  }

  return {
    data: payload,
    error: null,
    source: 'local',
    cloudSchemaReady: false,
  }
}
