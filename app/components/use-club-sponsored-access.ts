'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import type { ClubRole, ClubWorkspaceData } from '@/lib/club-workspace'

type ClubWorkspaceResponse = {
  ok: boolean
  message?: string
  workspace?: ClubWorkspaceData
}

type ClubSponsoredAccess = {
  checking: boolean
  allowed: boolean
  workspace: ClubWorkspaceData | null
}

type ClubSponsoredAccessResult = ClubSponsoredAccess & {
  requestKey: string
}

export function useClubSponsoredAccess(clubId: string, eligibleRoles: readonly ClubRole[]): ClubSponsoredAccess {
  const { authResolved, session, userId } = useAuth()
  const accessToken = session?.access_token ?? ''
  const roleKey = useMemo(() => [...eligibleRoles].sort().join('|'), [eligibleRoles])
  const requestKey = `${clubId}|${userId ?? ''}|${roleKey}|${accessToken}`
  const [state, setState] = useState<ClubSponsoredAccessResult>({
    requestKey: '',
    checking: false,
    allowed: false,
    workspace: null,
  })

  useEffect(() => {
    if (!clubId || !authResolved || !userId || !accessToken) return

    const controller = new AbortController()
    void fetch(`/api/clubs?clubId=${encodeURIComponent(clubId)}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const payload = await response.json() as ClubWorkspaceResponse
        if (!response.ok) throw new Error(payload.message || 'Club access could not be checked.')
        return payload.workspace ?? null
      })
      .then((workspace) => {
        if (!workspace) {
          setState({ requestKey, checking: false, allowed: false, workspace: null })
          return
        }
        const allowedRoles = roleKey.split('|') as ClubRole[]
        const allowed = workspace.currentMembership.status === 'active'
          && workspace.currentMembership.roles.some((role) => allowedRoles.includes(role))
        setState({ requestKey, checking: false, allowed, workspace })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ requestKey, checking: false, allowed: false, workspace: null })
      })

    return () => controller.abort()
  }, [accessToken, authResolved, clubId, requestKey, roleKey, userId])

  if (!clubId) return { checking: false, allowed: false, workspace: null }
  if (!authResolved) return { checking: true, allowed: false, workspace: null }
  if (!userId || !accessToken) return { checking: false, allowed: false, workspace: null }
  if (state.requestKey !== requestKey) return { checking: true, allowed: false, workspace: null }
  return state
}
