import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataAssistTeamSummaryParsedDraft } from './data-assist-team-summary-parser'

type PlayerRow = { id?: string | null; name?: string | null }
type ProfileRow = { id?: string | null; linked_player_id?: string | null }
type TeamLinkRow = {
  profile_user_id?: string | null
  normalized_team_name?: string | null
  league_name?: string | null
  flight?: string | null
  status?: string | null
}
type NoticeRow = { recipient_profile_id?: string | null }

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeKey(value: string | null | undefined) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Creates a private inbox prompt only for accounts that already linked their
 * player profile. Importing a roster never creates a profile/team connection.
 */
export async function notifyLinkedPlayersOfImportedTeam(input: {
  supabase: SupabaseClient
  actorUserId: string
  batchId: string
  parsedDraft: DataAssistTeamSummaryParsedDraft
}) {
  const playerNames = Array.from(new Set(input.parsedDraft.players.map((player) => cleanText(player.name)).filter(Boolean)))
  const teamName = cleanText(input.parsedDraft.rosterTeamName)
  if (!playerNames.length || !teamName) return 0

  const { data: playerData, error: playerError } = await input.supabase
    .from('players')
    .select('id,name')
    .in('name', playerNames)
    .limit(200)
  if (playerError) return 0

  const playerIds = ((playerData || []) as PlayerRow[])
    .filter((player) => playerNames.some((name) => normalizeKey(name) === normalizeKey(player.name)))
    .map((player) => cleanText(player.id))
    .filter(Boolean)
  if (!playerIds.length) return 0

  const { data: profileData, error: profileError } = await input.supabase
    .from('profiles')
    .select('id,linked_player_id')
    .in('linked_player_id', playerIds)
    .limit(200)
  if (profileError) return 0

  const recipientProfileIds = Array.from(new Set(
    ((profileData || []) as ProfileRow[])
      .map((profile) => cleanText(profile.id))
      .filter((profileId) => profileId && profileId !== input.actorUserId),
  ))
  if (!recipientProfileIds.length) return 0

  const leagueName = cleanText(input.parsedDraft.leagueName)
  const flight = cleanText(input.parsedDraft.flight)
  const normalizedTeamName = normalizeKey(teamName)
  const [linkResult, existingNoticeResult] = await Promise.all([
    input.supabase
      .from('team_profile_links')
      .select('profile_user_id,normalized_team_name,league_name,flight,status')
      .in('profile_user_id', recipientProfileIds)
      .eq('status', 'accepted')
      .limit(200),
    input.supabase
      .from('internal_notifications')
      .select('recipient_profile_id')
      .in('recipient_profile_id', recipientProfileIds)
      .eq('href', `/team-connections?source=import&batch=${encodeURIComponent(input.batchId)}`)
      .limit(200),
  ])
  if (linkResult.error || existingNoticeResult.error) return 0

  const alreadyLinked = new Set(
    ((linkResult.data || []) as TeamLinkRow[])
      .filter((link) => normalizeKey(link.normalized_team_name) === normalizedTeamName
        && normalizeKey(link.league_name) === normalizeKey(leagueName)
        && normalizeKey(link.flight) === normalizeKey(flight))
      .map((link) => cleanText(link.profile_user_id))
      .filter(Boolean),
  )
  const alreadyNotified = new Set(
    ((existingNoticeResult.data || []) as NoticeRow[])
      .map((notice) => cleanText(notice.recipient_profile_id))
      .filter(Boolean),
  )
  const recipients = recipientProfileIds.filter((profileId) => !alreadyLinked.has(profileId) && !alreadyNotified.has(profileId))
  if (!recipients.length) return 0

  const { error: insertError } = await input.supabase.from('internal_notifications').insert(
    recipients.map((recipientProfileId) => ({
      recipient_profile_id: recipientProfileId,
      actor_user_id: input.actorUserId,
      notification_type: 'system',
      title: 'New team ready to connect',
      body: `${teamName} is ready to review. Link it to add Team Chat and your schedule.`,
      href: `/team-connections?source=import&batch=${encodeURIComponent(input.batchId)}`,
    })),
  )
  return insertError ? 0 : recipients.length
}
