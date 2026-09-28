import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'
import { isCaptainShareKind, type CaptainShareLink } from '@/lib/captain-share-links'

type CaptainShareLinkRow = {
  token?: string | null
  kind?: string | null
  target_href?: string | null
  team_name?: string | null
  opponent?: string | null
  match_date?: string | null
  detail?: string | null
  expires_at?: string | null
}

export function getCaptainShareServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error('Captain share previews are not configured.')
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function getCaptainShareLink(token: string): Promise<CaptainShareLink | null> {
  if (!/^[A-Za-z0-9_-]{12,32}$/.test(token)) return null
  const { data, error } = await getCaptainShareServiceClient()
    .from('captain_share_links')
    .select('token,kind,target_href,team_name,opponent,match_date,detail,expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return null
  const row = data as CaptainShareLinkRow
  if (!row.token || !isCaptainShareKind(row.kind) || !isSafeCaptainShareTarget(row.target_href || '')) return null
  return {
    token: row.token,
    kind: row.kind,
    targetHref: row.target_href || '/',
    teamName: cleanShareText(row.team_name),
    opponent: cleanShareText(row.opponent),
    matchDate: cleanShareText(row.match_date, 10),
    detail: cleanShareText(row.detail, 240),
    expiresAt: row.expires_at || '',
  }
}

export function isSafeCaptainShareTarget(value: string) {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false
  try {
    const url = new URL(value, 'https://www.tenaceiq.com')
    return url.origin === 'https://www.tenaceiq.com' && (
      [
        '/team-room',
        '/captain/matchup-sheet',
        '/captain/record-result',
        '/captain/practice',
        '/team-room/join',
      ].includes(url.pathname)
      || url.pathname.startsWith('/availability/')
    )
  } catch {
    return false
  }
}

export function cleanShareText(value: unknown, maxLength = 160) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''
}
