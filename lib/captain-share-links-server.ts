import 'server-only'

import { cache } from 'react'
import { getCaptainAvailabilityServiceClient } from './captain-availability-request-server'
import { isCaptainShareKind, safeCaptainShareTarget, type CaptainShareKind } from './captain-share-preview'

export type CaptainShortShare = {
  token: string
  kind: CaptainShareKind
  targetHref: string
  teamName: string
  opponent: string
  matchDate: string
  detail: string
}

export const loadCaptainShortShare = cache(async (rawToken: string): Promise<CaptainShortShare | null> => {
  const token = rawToken.trim()
  if (!/^[A-Za-z0-9_-]{12,32}$/.test(token)) return null

  const service = getCaptainAvailabilityServiceClient()
  const { data, error } = await service
    .from('captain_share_links')
    .select('token,kind,target_href,team_name,opponent,match_date,detail,expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data || !isCaptainShareKind(String(data.kind))) return null
  if (data.expires_at && new Date(String(data.expires_at)).getTime() <= Date.now()) return null

  return {
    token: String(data.token),
    kind: data.kind as CaptainShareKind,
    targetHref: safeCaptainShareTarget(String(data.target_href || '')),
    teamName: String(data.team_name || ''),
    opponent: String(data.opponent || ''),
    matchDate: String(data.match_date || ''),
    detail: String(data.detail || ''),
  }
})
