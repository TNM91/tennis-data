'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClubCommunicationSummary, getPreferredClubCommunicationStaffClub, type ClubCommunicationItem } from '@/lib/club-communication'
import { CLUB_COMMUNICATION_UPDATED_EVENT } from '@/lib/club-communication-events'
import type { Club, ClubMembership } from '@/lib/club-workspace'

const CACHE_WINDOW_MS = 60_000
const ACTIVE_CLUB_KEY = 'tenaceiq.club.active'

export type ClubCommunicationAttention = {
  clubId: string
  clubName: string
  href: string
  attentionCount: number
  unreadCount: number
  needsReplyCount: number
}

type ClubListPayload = {
  clubs?: Club[]
  memberships?: ClubMembership[]
}

type CommunicationPayload = {
  items?: ClubCommunicationItem[]
}

type CacheEntry = {
  value: ClubCommunicationAttention | null
  loadedAt: number
}

const attentionCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, Promise<ClubCommunicationAttention | null>>()

export function useClubCommunicationAttention({
  accessToken,
  userId,
}: {
  accessToken?: string | null
  userId?: string | null
}) {
  const [attention, setAttention] = useState<ClubCommunicationAttention | null>(() => (
    userId ? attentionCache.get(userId)?.value ?? null : null
  ))

  const refresh = useCallback(async (force = false) => {
    if (!accessToken || !userId) {
      setAttention(null)
      return null
    }
    const value = await loadClubCommunicationAttention(accessToken, userId, force)
    setAttention(value)
    return value
  }, [accessToken, userId])

  useEffect(() => {
    if (!accessToken || !userId) {
      const timeout = window.setTimeout(() => setAttention(null), 0)
      return () => window.clearTimeout(timeout)
    }

    let active = true
    const load = (force = false) => {
      void loadClubCommunicationAttention(accessToken, userId, force).then((value) => {
        if (active) setAttention(value)
      })
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    const refreshAfterChange = () => load(true)

    load()
    window.addEventListener('pageshow', refreshWhenVisible)
    window.addEventListener(CLUB_COMMUNICATION_UPDATED_EVENT, refreshAfterChange)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.removeEventListener('pageshow', refreshWhenVisible)
      window.removeEventListener(CLUB_COMMUNICATION_UPDATED_EVENT, refreshAfterChange)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [accessToken, userId])

  return { attention, refresh }
}

async function loadClubCommunicationAttention(accessToken: string, userId: string, force: boolean) {
  const cached = attentionCache.get(userId)
  if (!force && cached && Date.now() - cached.loadedAt < CACHE_WINDOW_MS) return cached.value
  const pending = pendingRequests.get(userId)
  if (pending) return pending

  const request = fetchClubCommunicationAttention(accessToken)
    .then((value) => {
      attentionCache.set(userId, { value, loadedAt: Date.now() })
      return value
    })
    .catch(() => null)
    .finally(() => pendingRequests.delete(userId))
  pendingRequests.set(userId, request)
  return request
}

async function fetchClubCommunicationAttention(accessToken: string): Promise<ClubCommunicationAttention | null> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const clubResponse = await fetch('/api/clubs', { cache: 'no-store', headers })
  if (!clubResponse.ok) return null
  const clubPayload = await clubResponse.json() as ClubListPayload
  const clubs = clubPayload.clubs ?? []
  const club = getPreferredClubCommunicationStaffClub(clubs, clubPayload.memberships ?? [], readStoredClubId())
  if (!club) return null

  const communicationResponse = await fetch(`/api/clubs/${encodeURIComponent(club.id)}/communication`, { cache: 'no-store', headers })
  if (!communicationResponse.ok) return null
  const communicationPayload = await communicationResponse.json() as CommunicationPayload
  const summary = getClubCommunicationSummary(communicationPayload.items ?? [])
  if (!summary.attentionCount) return null

  const params = new URLSearchParams({ clubId: club.id, tab: 'home', communication: '1' })
  return {
    clubId: club.id,
    clubName: club.name,
    href: `/clubs?${params.toString()}`,
    ...summary,
  }
}

function readStoredClubId() {
  try {
    return window.localStorage.getItem(ACTIVE_CLUB_KEY) || ''
  } catch {
    return ''
  }
}
