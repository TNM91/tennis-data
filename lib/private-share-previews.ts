import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

function clean(value: unknown, maxLength = 160) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''
}

function publicClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function getClubInviteSharePreview(token: string) {
  const { data } = await publicClient().rpc('get_club_invite_preview', { target_invite_token: token })
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  if (!row) return null
  return {
    clubName: clean(row.club_name) || 'Club invitation',
    targetName: clean(row.target_name),
    roles: Array.isArray(row.invite_roles) ? row.invite_roles.map((role) => clean(role, 40)).filter(Boolean) : [],
  }
}

export async function getClubRenewalSharePreview(token: string) {
  const { data } = await publicClient().rpc('get_club_group_renewal_preview', { target_response_token: token })
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  if (!row) return null
  return {
    clubName: clean(row.club_name) || 'Club tennis',
    groupName: clean(row.group_name) || 'Program',
    seasonLabel: clean(row.season_label),
    playerName: clean(row.player_name),
  }
}

export async function getCoachInviteSharePreview(token: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data } = await service
    .from('coach_student_invites')
    .select('message,coach_player_links(player_name,identity_slug,level_label)')
    .eq('invite_token', token)
    .maybeSingle()
  if (!data) return null
  const relation = Array.isArray(data.coach_player_links) ? data.coach_player_links[0] : data.coach_player_links
  return {
    playerName: clean(relation?.player_name) || 'Invited player',
    levelLabel: clean(relation?.level_label),
    message: clean(data.message, 180),
  }
}
