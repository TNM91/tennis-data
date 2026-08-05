import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataAssistScorecardParsedDraft } from './data-assist-ocr'
import {
  buildTeamRoomHref,
  buildTeamRoomScopeId,
  canManageTeamRoom,
  normalizeTeamRoomKey,
} from './team-room'
import {
  buildTeamRoomFinalResult,
  type TeamRoomCompletedMatch,
} from './team-room-final-result'
import {
  buildTeamRoomResultAnnouncement,
  buildTeamRoomScorecardFingerprint,
} from './team-room-result-announcement'
import { sendTeamRoomPush } from './team-room-push-server'

type TeamLinkRow = {
  profile_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  team_role: string
  team_roles: string[] | null
  status: string
}

type ConversationRow = {
  id: string
  related_entity_id: string
}

type MatchCardRow = {
  conversation_id: string
  metadata: Record<string, unknown> | null
}

type ExistingAnnouncementRow = {
  id: string
  conversation_id: string
  metadata: Record<string, unknown> | null
}

export async function announceTeamRoomScorecardResult(input: {
  service: SupabaseClient
  userId: string
  draft: DataAssistScorecardParsedDraft
}) {
  const externalMatchId = clean(input.draft.externalMatchId)
  if (!externalMatchId) return { inserted: 0, updated: 0 }

  const [{ data: matchData }, { data: linkData }] = await Promise.all([
    input.service
      .from('matches')
      .select('id,external_match_id,home_team,away_team,match_date,league_name,flight,winner_side,score,status,line_number')
      .eq('external_match_id', externalMatchId)
      .eq('status', 'completed')
      .is('line_number', null)
      .maybeSingle(),
    input.service
      .from('team_profile_links')
      .select('profile_user_id,team_name,normalized_team_name,league_name,flight,team_role,team_roles,status')
      .eq('profile_user_id', input.userId)
      .eq('status', 'accepted'),
  ])
  const match = matchData as TeamRoomCompletedMatch | null
  if (!match) return { inserted: 0, updated: 0 }

  const matchTeamKeys = new Set([
    normalizeTeamRoomKey(match.home_team),
    normalizeTeamRoomKey(match.away_team),
  ].filter(Boolean))
  const links = ((linkData ?? []) as TeamLinkRow[]).filter((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles
      : [link.team_role]
    return canManageTeamRoom(roles) && matchTeamKeys.has(
      clean(link.normalized_team_name) || normalizeTeamRoomKey(link.team_name),
    )
  })
  if (!links.length) return { inserted: 0, updated: 0 }

  const linkByScopeId = new Map(links.map((link) => [buildTeamRoomScopeId({
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
  }), link]))
  const { data: conversationData } = await input.service
    .from('internal_conversations')
    .select('id,related_entity_id')
    .eq('related_entity_type', 'team_room')
    .in('related_entity_id', Array.from(linkByScopeId.keys()))
  const conversations = (conversationData ?? []) as ConversationRow[]
  if (!conversations.length) return { inserted: 0, updated: 0 }

  const conversationIds = conversations.map((conversation) => conversation.id)
  const { data: cardData } = await input.service
    .from('internal_messages')
    .select('conversation_id,metadata')
    .in('conversation_id', conversationIds)
    .contains('metadata', { teamRoomCard: true })
    .limit(300)
  const matchingConversationIds = new Set(((cardData ?? []) as MatchCardRow[]).flatMap((row) => {
    const metadata = row.metadata
    if (!metadata) return []
    const exactExternalId = clean(metadata.externalMatchId) === externalMatchId
    const exactMatchId = clean(metadata.matchId) === clean(match.id)
    return exactExternalId || exactMatchId ? [row.conversation_id] : []
  }))
  const targets = conversations.filter((conversation) => matchingConversationIds.has(conversation.id))
  if (!targets.length) return { inserted: 0, updated: 0 }

  const fingerprint = buildTeamRoomScorecardFingerprint(input.draft)
  const { data: existingData } = await input.service
    .from('internal_messages')
    .select('id,conversation_id,metadata')
    .in('conversation_id', targets.map((target) => target.id))
    .contains('metadata', { teamRoomResultAnnouncement: true, externalMatchId })
  const existingByConversationId = new Map(((existingData ?? []) as ExistingAnnouncementRow[])
    .map((row) => [row.conversation_id, row]))

  let inserted = 0
  let updated = 0
  for (const target of targets) {
    const link = linkByScopeId.get(target.related_entity_id)
    const result = link ? buildTeamRoomFinalResult(match, link.team_name) : null
    if (!link || !result) continue
    const body = buildTeamRoomResultAnnouncement(result)
    const metadata = {
      teamRoomResultAnnouncement: true,
      externalMatchId,
      matchId: match.id,
      matchDate: clean(match.match_date),
      teamName: result.teamName,
      opponentName: result.opponentName,
      teamScore: result.teamScore,
      opponentScore: result.opponentScore,
      outcome: result.outcome,
      resultFingerprint: fingerprint,
    }
    const existing = existingByConversationId.get(target.id)
    if (existing) {
      if (clean(existing.metadata?.resultFingerprint) === fingerprint) continue
      const { error } = await input.service
        .from('internal_messages')
        .update({ body, metadata, edited_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (!error) updated += 1
      continue
    }

    const { data: insertedMessage, error } = await input.service
      .from('internal_messages')
      .insert({
        conversation_id: target.id,
        sender_user_id: input.userId,
        body,
        message_kind: 'announcement',
        metadata,
      })
      .select('id')
      .single()
    if (error || !insertedMessage?.id) continue
    inserted += 1
    await notifyResult(input.service, {
      conversationId: target.id,
      actorUserId: input.userId,
      link,
      body,
      messageId: insertedMessage.id,
    })
  }
  return { inserted, updated }
}

async function notifyResult(service: SupabaseClient, input: {
  conversationId: string
  actorUserId: string
  link: TeamLinkRow
  body: string
  messageId: string
}) {
  const { data } = await service
    .from('internal_conversation_participants')
    .select('profile_id,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((data ?? []) as Array<{ profile_id: string; muted: boolean | null }>)
    .filter((participant) => participant.profile_id !== input.actorUserId && participant.muted !== true)
  if (!recipients.length) return

  const href = buildTeamRoomHref({
    teamName: input.link.team_name,
    leagueName: input.link.league_name,
    flight: input.link.flight,
    messageId: input.messageId,
  })
  const title = `${input.link.team_name} final result`
  await service.from('internal_notifications').insert(recipients.map((recipient) => ({
    recipient_profile_id: recipient.profile_id,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body: input.body.slice(0, 180),
    href,
    conversation_id: input.conversationId,
  })))
  await sendTeamRoomPush(service, recipients.map((recipient) => recipient.profile_id), {
    title,
    body: input.body.slice(0, 180),
    href,
    tag: `team-room-result-${input.conversationId}`,
  })
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
