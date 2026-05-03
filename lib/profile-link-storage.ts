export type StoredProfileLink = {
  linked_player_id: string | null
  linked_player_name: string | null
  linked_team_name: string | null
  linked_league_name: string | null
  linked_flight?: string | null
  linked_team_at?: string | null
}

const LOCAL_PROFILE_LINK_PREFIX = 'tenaceiq-profile-link-v1:'

export function isMissingProfileLinkSchemaError(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return (
    normalized.includes('linked_player_id') ||
    normalized.includes('linked_player_name') ||
    normalized.includes('linked_team_name') ||
    normalized.includes('linked_league_name') ||
    normalized.includes('linked_flight') ||
    normalized.includes('linked_team_at')
  )
}

export function readLocalProfileLink(userId: string | null | undefined): StoredProfileLink | null {
  if (!userId || typeof window === 'undefined') return null

  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${LOCAL_PROFILE_LINK_PREFIX}${userId}`) || 'null') as
      | StoredProfileLink
      | null
    return parsed
  } catch {
    return null
  }
}

export function writeLocalProfileLink(userId: string, link: StoredProfileLink) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${LOCAL_PROFILE_LINK_PREFIX}${userId}`, JSON.stringify(link))
}
