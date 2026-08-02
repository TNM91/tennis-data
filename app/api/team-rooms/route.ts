import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildTeamRoomHref,
  buildTeamRoomScopeId,
  canManageTeamRoom,
  normalizeTeamRoomKey,
} from '@/lib/team-room'
import {
  buildLineupChanges,
  normalizeLineupRows,
  selectActiveTeamRoomCard,
  teamRoomCardState,
  type TeamRoomReminderTarget,
} from '@/lib/team-room-match-flow'
import { sendTeamRoomPush } from '@/lib/team-room-push-server'

export const runtime = 'nodejs'

type TeamLinkRow = {
  id?: string
  profile_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  team_role: string
  team_roles: string[] | null
  is_default?: boolean | null
  updated_at?: string | null
}

type ConversationRow = {
  id: string
  subject: string | null
  created_by_user_id: string
  related_entity_id: string
  created_at: string | null
  updated_at: string | null
}

type ParticipantRow = {
  profile_id: string
  participant_role: string | null
  muted: boolean | null
  last_read_at?: string | null
}

type ProfileRow = {
  id: string
  message_display_name?: string | null
  linked_player_name?: string | null
  linked_player_id?: string | null
  role?: string | null
}

type MessageRow = {
  id: string
  sender_user_id: string
  body: string
  message_kind: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  edited_at: string | null
  deleted_at: string | null
  reply_to_message_id: string | null
}

type ReactionRow = {
  message_id: string
  profile_id: string
  reaction: 'ack' | 'helpful' | 'celebrate'
}

type MatchResponseRow = {
  message_id: string
  profile_id: string
  response: 'yes' | 'maybe' | 'no'
  updated_at: string | null
}

type LineupAcknowledgmentRow = {
  message_id: string
  profile_id: string
  lineup_version: number
  updated_at: string | null
}

type ReminderScheduleRow = {
  message_id: string
  reminder_at: string
  status: 'scheduled' | 'sent' | 'cancelled'
  sent_at: string | null
  notification_count: number | null
}

type TeamRoomMessageCardPayload = Record<string, unknown> & {
  lineup: unknown
  matchDate: string
  state: 'active' | 'upcoming' | 'archived'
  lineupVersion: number
  lineupChanges: string[]
  acknowledged: boolean
  acknowledgmentSummary: { total: number; profileIds: string[] }
  reminder: {
    reminderAt: string
    status: string
    sentAt: string
    notificationCount: number
  } | null
}

type TeamRoomActionBody = {
  action?: unknown
  teamName?: unknown
  leagueName?: unknown
  flight?: unknown
  body?: unknown
  announcement?: unknown
  muted?: unknown
  card?: unknown
  messageId?: unknown
  response?: unknown
  reminderAt?: unknown
  replyToMessageId?: unknown
  reaction?: unknown
  memberId?: unknown
}

export async function GET(request: Request) {
  const auth = await getTeamRoomAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const linksResult = await loadAcceptedTeamLinks(auth.service, auth.userId)
  if (!linksResult.ok) return Response.json({ ok: false, message: linksResult.message }, { status: 500 })
  if (!linksResult.links.length) {
    return Response.json({
      ok: true,
      room: null,
      teams: [],
      message: 'Link a team to your profile before opening its Team Room.',
    })
  }

  const selected = selectTeamLink(linksResult.links, {
    teamName: url.searchParams.get('team'),
    leagueName: url.searchParams.get('league'),
    flight: url.searchParams.get('flight'),
  })
  if (!selected) {
    return Response.json({ ok: false, message: 'This team is not linked to your profile.' }, { status: 403 })
  }

  if (url.searchParams.get('summary') === '1') {
    const summaryResult = await loadTeamRoomSummary(auth.service, auth.userId, selected)
    if (!summaryResult.ok) return Response.json({ ok: false, message: summaryResult.message }, { status: summaryResult.status })
    return Response.json({ ok: true, summary: summaryResult.summary })
  }
  const roomResult = await loadTeamRoom(auth.service, auth.userId, selected)
  if (!roomResult.ok) return Response.json({ ok: false, message: roomResult.message }, { status: roomResult.status })

  return Response.json({
    ok: true,
    teams: linksResult.links.map(toTeamOption),
    room: roomResult.room,
  })
}

export async function POST(request: Request) {
  const auth = await getTeamRoomAuth(request)
  if (!auth.ok) return auth.response

  let body: TeamRoomActionBody
  try {
    body = await request.json() as TeamRoomActionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid Team Room request.' }, { status: 400 })
  }

  const linksResult = await loadAcceptedTeamLinks(auth.service, auth.userId)
  if (!linksResult.ok) return Response.json({ ok: false, message: linksResult.message }, { status: 500 })
  const selected = selectTeamLink(linksResult.links, {
    teamName: cleanText(body.teamName),
    leagueName: cleanText(body.leagueName),
    flight: cleanText(body.flight),
  })
  if (!selected) {
    return Response.json({ ok: false, message: 'This team is not linked to your profile.' }, { status: 403 })
  }

  const roomResult = await ensureTeamRoom(auth.service, selected)
  if (!roomResult.ok) return Response.json({ ok: false, message: roomResult.message }, { status: roomResult.status })
  const conversation = roomResult.conversation
  const syncedMembers = await syncTeamRoomParticipants(auth.service, conversation.id, selected)
  if (!syncedMembers.some((member) => member.id === auth.userId)) {
    return Response.json({ ok: false, message: 'You no longer have access to this Team Chat.' }, { status: 403 })
  }

  const action = cleanText(body.action)
  if (action === 'send') {
    const messageBody = cleanText(body.body).slice(0, 2400)
    if (!messageBody) return Response.json({ ok: false, message: 'Write a message first.' }, { status: 400 })
    const isAnnouncement = body.announcement === true
    if (isAnnouncement && !canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can post an announcement.' }, { status: 403 })
    }
    const replyToMessageId = cleanText(body.replyToMessageId)
    if (replyToMessageId) {
      const { data: replyTarget } = await auth.service
        .from('internal_messages')
        .select('id')
        .eq('id', replyToMessageId)
        .eq('conversation_id', conversation.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (!replyTarget) {
        return Response.json({ ok: false, message: 'The message you replied to is no longer available.' }, { status: 400 })
      }
    }

    const { data: message, error } = await auth.service
      .from('internal_messages')
      .insert({
        conversation_id: conversation.id,
        sender_user_id: auth.userId,
        body: messageBody,
        message_kind: isAnnouncement ? 'announcement' : 'message',
        reply_to_message_id: replyToMessageId || null,
      })
      .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

    await auth.service
      .from('internal_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)

    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: messageBody,
      announcement: isAnnouncement,
    })

    return Response.json({ ok: true, message: toMessage(message as MessageRow, new Map(), auth.userId) })
  }

  if (action === 'post_match_card') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can post a match update.' }, { status: 403 })
    }
    const card = cleanMatchCard(body.card)
    if (!card.matchDate) {
      return Response.json({ ok: false, message: 'Choose the match date first.' }, { status: 400 })
    }

    const { data: existingRows } = await auth.service
      .from('internal_messages')
      .select('id,metadata')
      .eq('conversation_id', conversation.id)
      .contains('metadata', { teamRoomCard: true, matchDate: card.matchDate })
      .order('created_at', { ascending: false })
      .limit(1)

    const existingId = cleanText(existingRows?.[0]?.id)
    const previousCard = isMatchCardMetadata(existingRows?.[0]?.metadata)
      ? cleanMatchCard(existingRows?.[0]?.metadata)
      : null
    const effectiveCard = card.cardType === 'availability' && previousCard?.cardType === 'projected_lineup'
      ? {
          ...previousCard,
          opponent: card.opponent || previousCard.opponent,
          matchTime: card.matchTime || previousCard.matchTime,
          facility: card.facility || previousCard.facility,
        }
      : card
    const lineupChanges = effectiveCard.cardType === 'projected_lineup'
      ? buildLineupChanges(previousCard?.lineup || [], effectiveCard.lineup)
      : []
    const previousLineupVersion = Math.max(0, Number(existingRows?.[0]?.metadata?.lineupVersion) || 0)
    const lineupVersion = effectiveCard.cardType === 'projected_lineup'
      ? Math.max(1, previousLineupVersion + (lineupChanges.length && previousLineupVersion ? 1 : 0))
      : 0
    const metadata = {
      ...effectiveCard,
      teamRoomCard: true,
      lineupVersion,
      lineupChanges,
      lineupChangedAt: lineupChanges.length ? new Date().toISOString() : cleanText(existingRows?.[0]?.metadata?.lineupChangedAt),
    }
    const cardBody = effectiveCard.cardType === 'projected_lineup'
      ? `Projected lineup for ${effectiveCard.matchDate}${effectiveCard.opponent ? ` vs ${effectiveCard.opponent}` : ''}. Please confirm whether you can play.`
      : `Can you play on ${effectiveCard.matchDate}${effectiveCard.opponent ? ` vs ${effectiveCard.opponent}` : ''}?`
    const writeResult = existingId
      ? await auth.service
          .from('internal_messages')
          .update({ body: cardBody, message_kind: 'announcement', metadata, edited_at: new Date().toISOString() })
          .eq('id', existingId)
          .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
          .single()
      : await auth.service
          .from('internal_messages')
          .insert({
            conversation_id: conversation.id,
            sender_user_id: auth.userId,
            body: cardBody,
            message_kind: 'announcement',
            metadata,
          })
          .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
          .single()
    if (writeResult.error) return Response.json({ ok: false, message: writeResult.error.message }, { status: 500 })

    await applySeasonAvailabilityDefaults(auth.service, {
      conversationId: conversation.id,
      messageId: writeResult.data.id,
      matchDate: effectiveCard.matchDate,
      scope: selected,
    })

    await auth.service
      .from('internal_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: cardBody,
      announcement: true,
    })

    return Response.json({ ok: true, messageId: writeResult.data.id, href: buildTeamRoomHref({
      teamName: selected.team_name,
      leagueName: selected.league_name,
      flight: selected.flight,
      date: card.matchDate,
      opponent: effectiveCard.opponent,
      time: effectiveCard.matchTime,
      facility: effectiveCard.facility,
    }) })
  }

  if (action === 'respond') {
    const messageId = cleanText(body.messageId)
    const response = cleanText(body.response) as MatchResponseRow['response']
    if (!messageId || !['yes', 'maybe', 'no'].includes(response)) {
      return Response.json({ ok: false, message: 'Choose Yes, Maybe, or No.' }, { status: 400 })
    }
    const { data: message, error: messageError } = await auth.service
      .from('internal_messages')
      .select('id,conversation_id,sender_user_id,metadata')
      .eq('id', messageId)
      .eq('conversation_id', conversation.id)
      .maybeSingle()
    if (messageError) return Response.json({ ok: false, message: messageError.message }, { status: 500 })
    if (!message || !isMatchCardMetadata(message.metadata)) {
      return Response.json({ ok: false, message: 'This match update is no longer available.' }, { status: 404 })
    }

    const updatedAt = new Date().toISOString()
    const { error: responseError } = await auth.service
      .from('team_room_message_responses')
      .upsert({
        conversation_id: conversation.id,
        message_id: messageId,
        profile_id: auth.userId,
        response,
        updated_at: updatedAt,
      }, { onConflict: 'message_id,profile_id' })
    if (responseError) return Response.json({ ok: false, message: responseError.message }, { status: 500 })

    const lineupVersion = Math.max(0, Number((message.metadata as Record<string, unknown>).lineupVersion) || 0)
    if (cleanText((message.metadata as Record<string, unknown>).cardType) === 'projected_lineup' && lineupVersion > 0) {
      await auth.service
        .from('team_room_lineup_acknowledgments')
        .upsert({
          conversation_id: conversation.id,
          message_id: messageId,
          profile_id: auth.userId,
          lineup_version: lineupVersion,
          updated_at: updatedAt,
        }, { onConflict: 'message_id,profile_id,lineup_version' })
    }

    const profileById = await loadProfileMap(auth.service, [auth.userId])
    const actor = profileById.get(auth.userId)
    const actorName = actor?.message_display_name?.trim() || actor?.linked_player_name?.trim() || 'A team member'
    await mirrorAvailabilityResponse(auth.service, {
      metadata: message.metadata as Record<string, unknown>,
      profile: actor,
      actorName,
      response,
      scope: selected,
    })
    await notifyTeamRoomManagers(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      actorName,
      response,
    })
    return Response.json({ ok: true, response, lineupAcknowledged: lineupVersion > 0, updatedAt })
  }

  if (action === 'acknowledge_lineup') {
    const messageId = cleanText(body.messageId)
    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, messageId)
    if (!cardResult.ok) return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    const lineupVersion = Math.max(0, Number(cardResult.metadata.lineupVersion) || 0)
    if (cleanText(cardResult.metadata.cardType) !== 'projected_lineup' || lineupVersion < 1) {
      return Response.json({ ok: false, message: 'This lineup does not need an acknowledgment.' }, { status: 400 })
    }

    const updatedAt = new Date().toISOString()
    const { error } = await auth.service
      .from('team_room_lineup_acknowledgments')
      .upsert({
        conversation_id: conversation.id,
        message_id: cardResult.messageId,
        profile_id: auth.userId,
        lineup_version: lineupVersion,
        updated_at: updatedAt,
      }, { onConflict: 'message_id,profile_id,lineup_version' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

    const profileById = await loadProfileMap(auth.service, [auth.userId])
    const actor = profileById.get(auth.userId)
    const actorName = actor?.message_display_name?.trim() || actor?.linked_player_name?.trim() || 'A team member'
    await notifyTeamRoomManagersOfLineupAck(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      actorName,
    })
    return Response.json({ ok: true, lineupVersion, updatedAt })
  }

  if (action === 'schedule_reminder') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can schedule reminders.' }, { status: 403 })
    }
    const reminderAt = cleanText(body.reminderAt)
    const reminderDate = new Date(reminderAt)
    if (!reminderAt || Number.isNaN(reminderDate.getTime()) || reminderDate.getTime() <= Date.now()) {
      return Response.json({ ok: false, message: 'Choose a reminder time in the future.' }, { status: 400 })
    }
    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, cleanText(body.messageId))
    if (!cardResult.ok) return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    const targets = await buildReminderTargets(auth.service, conversation.id, cardResult.messageId, cardResult.metadata)
    if (!targets.length) {
      return Response.json({ ok: false, message: 'Everyone has already completed this match update.' }, { status: 400 })
    }
    const { error } = await auth.service
      .from('team_room_reminder_schedules')
      .upsert({
        conversation_id: conversation.id,
        message_id: cardResult.messageId,
        created_by_user_id: auth.userId,
        reminder_at: reminderDate.toISOString(),
        targets,
        status: 'scheduled',
        sent_at: null,
        notification_count: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'message_id' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, reminderAt: reminderDate.toISOString(), targetCount: targets.length })
  }

  if (action === 'remind_waiting') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can send reminders.' }, { status: 403 })
    }
    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, cleanText(body.messageId))
    if (!cardResult.ok) return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    const targets = await buildReminderTargets(auth.service, conversation.id, cardResult.messageId, cardResult.metadata)
    if (!targets.length) return Response.json({ ok: true, notificationIds: [], targetCount: 0 })
    const notificationIds = await sendTeamRoomReminders(auth.service, {
      conversationId: conversation.id,
      messageId: cardResult.messageId,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      matchDate: cleanText(cardResult.metadata.matchDate),
      targets,
    })
    await auth.service
      .from('team_room_reminder_schedules')
      .upsert({
        conversation_id: conversation.id,
        message_id: cardResult.messageId,
        created_by_user_id: auth.userId,
        reminder_at: new Date().toISOString(),
        targets,
        status: 'sent',
        sent_at: new Date().toISOString(),
        notification_count: notificationIds.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'message_id' })
    return Response.json({ ok: true, notificationIds, targetCount: targets.length })
  }

  if (action === 'create_invite') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can invite new team members.' }, { status: 403 })
    }
    const now = new Date().toISOString()
    const { data: existing } = await auth.service
      .from('team_room_invites')
      .select('invite_token,expires_at')
      .eq('conversation_id', conversation.id)
      .eq('created_by_user_id', auth.userId)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let token = cleanText(existing?.invite_token)
    let expiresAt = cleanText(existing?.expires_at)
    if (!token) {
      const { data, error } = await auth.service
        .from('team_room_invites')
        .insert({
          conversation_id: conversation.id,
          created_by_user_id: auth.userId,
          team_name: selected.team_name,
          normalized_team_name: selected.normalized_team_name,
          league_name: selected.league_name,
          flight: selected.flight,
        })
        .select('invite_token,expires_at')
        .single()
      if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
      token = cleanText(data.invite_token)
      expiresAt = cleanText(data.expires_at)
    }

    const inviteUrl = `${new URL(request.url).origin}/team-room/join?token=${encodeURIComponent(token)}`
    return Response.json({ ok: true, inviteUrl, expiresAt })
  }

  if (action === 'toggle_reaction') {
    const messageId = cleanText(body.messageId)
    const reaction = cleanText(body.reaction) as ReactionRow['reaction']
    if (!messageId || !['ack', 'helpful', 'celebrate'].includes(reaction)) {
      return Response.json({ ok: false, message: 'Choose a message acknowledgment.' }, { status: 400 })
    }
    const { data: message } = await auth.service
      .from('internal_messages')
      .select('id')
      .eq('id', messageId)
      .eq('conversation_id', conversation.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!message) return Response.json({ ok: false, message: 'This message is no longer available.' }, { status: 404 })

    const { data: existing } = await auth.service
      .from('team_room_message_reactions')
      .select('message_id')
      .eq('message_id', messageId)
      .eq('profile_id', auth.userId)
      .eq('reaction', reaction)
      .maybeSingle()
    const reactionResult = existing
      ? await auth.service
          .from('team_room_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('profile_id', auth.userId)
          .eq('reaction', reaction)
      : await auth.service
          .from('team_room_message_reactions')
          .insert({ conversation_id: conversation.id, message_id: messageId, profile_id: auth.userId, reaction })
    if (reactionResult.error) return Response.json({ ok: false, message: reactionResult.error.message }, { status: 500 })
    return Response.json({ ok: true, active: !existing })
  }

  if (action === 'edit_message') {
    const messageId = cleanText(body.messageId)
    const nextBody = cleanText(body.body).slice(0, 2400)
    if (!messageId || !nextBody) return Response.json({ ok: false, message: 'Write the updated message first.' }, { status: 400 })
    const { data: message } = await auth.service
      .from('internal_messages')
      .select('id,sender_user_id,deleted_at')
      .eq('id', messageId)
      .eq('conversation_id', conversation.id)
      .maybeSingle()
    if (!message || message.deleted_at) return Response.json({ ok: false, message: 'This message is no longer available.' }, { status: 404 })
    if (message.sender_user_id !== auth.userId) {
      return Response.json({ ok: false, message: 'You can edit only your own message.' }, { status: 403 })
    }
    const { error } = await auth.service
      .from('internal_messages')
      .update({ body: nextBody, edited_at: new Date().toISOString() })
      .eq('id', messageId)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'delete_message') {
    const messageId = cleanText(body.messageId)
    const { data: message } = await auth.service
      .from('internal_messages')
      .select('id,sender_user_id,metadata,deleted_at')
      .eq('id', messageId)
      .eq('conversation_id', conversation.id)
      .maybeSingle()
    if (!message || message.deleted_at) return Response.json({ ok: false, message: 'This message is already removed.' }, { status: 404 })
    if (message.sender_user_id !== auth.userId && !canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only the sender or a captain can remove this message.' }, { status: 403 })
    }
    const attachment = cleanAttachmentMetadata(message.metadata)
    const nextMetadata = { ...((message.metadata || {}) as Record<string, unknown>), teamRoomAttachment: null }
    const { error } = await auth.service
      .from('internal_messages')
      .update({ body: 'Message removed.', metadata: nextMetadata, deleted_at: new Date().toISOString(), edited_at: new Date().toISOString() })
      .eq('id', messageId)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    if (attachment?.path) await auth.service.storage.from(attachment.bucket).remove([attachment.path])
    return Response.json({ ok: true })
  }

  if (action === 'revoke_invites') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can revoke team invites.' }, { status: 403 })
    }
    const now = new Date().toISOString()
    const { data, error } = await auth.service
      .from('team_room_invites')
      .update({ revoked_at: now })
      .eq('conversation_id', conversation.id)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .select('id')
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, revokedCount: data?.length || 0 })
  }

  if (action === 'remove_member' || action === 'restore_member') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can manage Team Chat members.' }, { status: 403 })
    }
    const memberId = cleanText(body.memberId)
    if (!memberId || memberId === auth.userId) {
      return Response.json({ ok: false, message: 'Choose another team member.' }, { status: 400 })
    }
    if (action === 'restore_member') {
      const { error } = await auth.service
        .from('team_room_member_removals')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('profile_id', memberId)
      if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
      return Response.json({ ok: true, restored: true })
    }
    const { data: participant } = await auth.service
      .from('internal_conversation_participants')
      .select('profile_id,participant_role')
      .eq('conversation_id', conversation.id)
      .eq('profile_id', memberId)
      .maybeSingle()
    if (!participant) return Response.json({ ok: false, message: 'This member is not in Team Chat.' }, { status: 404 })
    if (participant.participant_role === 'coordinator') {
      return Response.json({ ok: false, message: 'Captain access must be changed from the team link first.' }, { status: 400 })
    }
    const { error } = await auth.service
      .from('team_room_member_removals')
      .upsert({ conversation_id: conversation.id, profile_id: memberId, removed_by_user_id: auth.userId, removed_at: new Date().toISOString() }, { onConflict: 'conversation_id,profile_id' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    await auth.service
      .from('internal_conversation_participants')
      .delete()
      .eq('conversation_id', conversation.id)
      .eq('profile_id', memberId)
    return Response.json({ ok: true, removed: true })
  }

  if (action === 'set_mute') {
    const muted = body.muted === true
    const { error } = await auth.service
      .from('internal_conversation_participants')
      .update({ muted })
      .eq('conversation_id', conversation.id)
      .eq('profile_id', auth.userId)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, muted })
  }

  return Response.json({ ok: false, message: 'Choose a Team Room action.' }, { status: 400 })
}

async function loadTeamRoom(service: SupabaseClient, userId: string, selected: TeamLinkRow) {
  const ensured = await ensureTeamRoom(service, selected)
  if (!ensured.ok) return ensured
  const conversation = ensured.conversation
  const members = await syncTeamRoomParticipants(service, conversation.id, selected)
  if (!members.some((member) => member.id === userId)) {
    return { ok: false as const, status: 403, message: 'A captain removed this profile from Team Chat.' }
  }

  const { data: messageRows, error: messageError } = await service
    .from('internal_messages')
    .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(300)
  if (messageError) return { ok: false as const, status: 500, message: messageError.message }

  const typedMessageRows = (messageRows ?? []) as MessageRow[]
  const senderIds = Array.from(new Set([
    ...typedMessageRows.map((row) => row.sender_user_id),
    ...members.map((member) => member.id),
  ]))
  const profileById = await loadProfileMap(service, senderIds)
  const messageIds = typedMessageRows.map((row) => row.id)
  const [responseByMessageId, ackByMessageId, reminderByMessageId, reactionByMessageId, attachmentUrlByMessageId, management] = await Promise.all([
    loadMatchResponses(service, messageIds),
    loadLineupAcknowledgments(service, messageIds),
    loadReminderSchedules(service, messageIds),
    loadMessageReactions(service, messageIds),
    loadAttachmentUrls(service, typedMessageRows),
    canManageTeamRoom(teamRoles(selected))
      ? loadTeamRoomManagement(service, userId, conversation.id, selected, members)
      : Promise.resolve({ rosterMembers: [], removedMembers: [], activeInviteCount: 0 }),
  ])
  const activeCardId = selectActiveTeamRoomCard(typedMessageRows.flatMap((row) => {
    if (row.deleted_at || !isMatchCardMetadata(row.metadata)) return []
    return [{ id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) }]
  }))
  const rowById = new Map(typedMessageRows.map((row) => [row.id, row]))
  const messages = typedMessageRows.map((row) => {
    const replyRow = row.reply_to_message_id ? rowById.get(row.reply_to_message_id) : null
    const baseMessage = toMessage(
      row,
      profileById,
      userId,
      responseByMessageId.get(row.id) || [],
      ackByMessageId.get(row.id) || [],
      reminderByMessageId.get(row.id) || null,
      isMatchCardMetadata(row.metadata)
        ? teamRoomCardState({ id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) }, activeCardId)
        : null,
      reactionByMessageId.get(row.id) || [],
      attachmentUrlByMessageId.get(row.id) || '',
    )
    return {
      ...baseMessage,
      replyTo: replyRow ? {
        id: replyRow.id,
        senderName: profileById.get(replyRow.sender_user_id)?.message_display_name?.trim()
          || profileById.get(replyRow.sender_user_id)?.linked_player_name?.trim()
          || 'Team member',
        body: replyRow.deleted_at ? 'Message removed.' : replyRow.body.slice(0, 220),
      } : null,
    }
  })
  await service
    .from('internal_conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id)
    .eq('profile_id', userId)

  const currentParticipant = members.find((member) => member.id === userId)
  return {
    ok: true as const,
    room: {
      id: conversation.id,
      subject: conversation.subject || `${selected.team_name} Team Room`,
      teamName: selected.team_name,
      leagueName: selected.league_name,
      flight: selected.flight,
      roles: teamRoles(selected),
      canManage: canManageTeamRoom(teamRoles(selected)),
      muted: currentParticipant?.muted ?? false,
      members,
      rosterMembers: management.rosterMembers,
      removedMembers: management.removedMembers,
      activeInviteCount: management.activeInviteCount,
      activeCardId,
      actionQueue: buildTeamRoomActionQueue(members, messages.find((message) => message.id === activeCardId) || null),
      messages,
      href: buildTeamRoomHref({
        teamName: selected.team_name,
        leagueName: selected.league_name,
        flight: selected.flight,
      }),
    },
  }
}

async function loadTeamRoomSummary(service: SupabaseClient, userId: string, selected: TeamLinkRow) {
  const ensured = await ensureTeamRoom(service, selected)
  if (!ensured.ok) return ensured
  const conversation = ensured.conversation
  const members = await syncTeamRoomParticipants(service, conversation.id, selected)
  if (!members.some((member) => member.id === userId)) {
    return { ok: false as const, status: 403, message: 'A captain removed this profile from Team Chat.' }
  }
  const [participantResult, messagesResult] = await Promise.all([
    service
      .from('internal_conversation_participants')
      .select('last_read_at')
      .eq('conversation_id', conversation.id)
      .eq('profile_id', userId)
      .maybeSingle(),
    service
      .from('internal_messages')
      .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(300),
  ])
  if (messagesResult.error) return { ok: false as const, status: 500, message: messagesResult.error.message }

  const lastReadAt = cleanText(participantResult.data?.last_read_at)
  const messageRows = (messagesResult.data ?? []) as MessageRow[]
  const unreadCount = messageRows.filter((row) => (
    !row.deleted_at
    &&
    row.sender_user_id !== userId
    && (!lastReadAt || new Date(row.created_at || 0).getTime() > new Date(lastReadAt).getTime())
  )).length
  const activeCardId = selectActiveTeamRoomCard(messageRows.flatMap((row) => {
    if (row.deleted_at || !isMatchCardMetadata(row.metadata)) return []
    return [{ id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) }]
  }))
  const latestCard = messageRows.find((row) => row.id === activeCardId)
  let responses: MatchResponseRow[] = []
  let acknowledgments: LineupAcknowledgmentRow[] = []
  let reminders: ReminderScheduleRow | null = null
  if (latestCard) {
    ;[responses, acknowledgments, reminders] = await Promise.all([
      loadMatchResponses(service, [latestCard.id]).then((rows) => rows.get(latestCard.id) || []),
      loadLineupAcknowledgments(service, [latestCard.id]).then((rows) => rows.get(latestCard.id) || []),
      loadReminderSchedules(service, [latestCard.id]).then((rows) => rows.get(latestCard.id) || null),
    ])
  }
  const profileById = await loadProfileMap(service, members.map((member) => member.id))
  const message = latestCard
    ? toMessage(latestCard, profileById, userId, responses, acknowledgments, reminders, 'active')
    : null
  const actionQueue = buildTeamRoomActionQueue(members, message)
  const pendingCount = canManageTeamRoom(teamRoles(selected)) ? actionQueue.waitingCount : 0

  return {
    ok: true as const,
    summary: {
      unreadCount,
      pendingCount,
      maybeCount: actionQueue.maybeCount,
      unseenLineupCount: actionQueue.unseenLineupCount,
      unresolvedCount: actionQueue.unresolvedCount,
      responseCount: responses.length,
      latestResponseAt: responses
        .map((row) => row.updated_at || '')
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || '',
      latestMatchDate: latestCard ? cleanText(latestCard.metadata?.matchDate) : '',
      reminderAt: actionQueue.reminderAt,
      reminderStatus: actionQueue.reminderStatus,
    },
  }
}

async function ensureTeamRoom(service: SupabaseClient, selected: TeamLinkRow) {
  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  let { data, error } = await service
    .from('internal_conversations')
    .select('id,subject,created_by_user_id,related_entity_id,created_at,updated_at')
    .eq('related_entity_type', 'team_room')
    .eq('related_entity_id', scopeId)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }

  if (!data) {
    const inserted = await service
      .from('internal_conversations')
      .insert({
        conversation_type: 'team',
        subject: `${selected.team_name} Team Room`,
        status: 'open',
        created_by_user_id: selected.profile_user_id,
        related_entity_type: 'team_room',
        related_entity_id: scopeId,
        metadata: {
          entityType: 'team_room',
          entityId: scopeId,
          teamName: selected.team_name,
          leagueName: selected.league_name,
          flight: selected.flight,
        },
      })
      .select('id,subject,created_by_user_id,related_entity_id,created_at,updated_at')
      .single()
    data = inserted.data
    error = inserted.error
    if (error) {
      const raced = await service
        .from('internal_conversations')
        .select('id,subject,created_by_user_id,related_entity_id,created_at,updated_at')
        .eq('related_entity_type', 'team_room')
        .eq('related_entity_id', scopeId)
        .maybeSingle()
      if (raced.error || !raced.data) {
        return { ok: false as const, status: 500, message: raced.error?.message || error.message }
      }
      data = raced.data
    }
  }

  return { ok: true as const, conversation: data as ConversationRow }
}

async function syncTeamRoomParticipants(service: SupabaseClient, conversationId: string, selected: TeamLinkRow) {
  const { data: linkedRows } = await service
    .from('team_profile_links')
    .select('profile_user_id,team_role,team_roles,team_name,normalized_team_name,league_name,flight,status')
    .eq('normalized_team_name', selected.normalized_team_name)
    .eq('status', 'accepted')

  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  const scopedLinks = ((linkedRows ?? []) as TeamLinkRow[]).filter((link) => buildTeamRoomScopeId({
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
  }) === scopeId)
  if (!scopedLinks.some((link) => link.profile_user_id === selected.profile_user_id)) scopedLinks.push(selected)

  const { data: removalRows } = await service
    .from('team_room_member_removals')
    .select('profile_id')
    .eq('conversation_id', conversationId)
  const removedIds = new Set(((removalRows ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id))
  const activeLinks = scopedLinks.filter((link) => canManageTeamRoom(teamRoles(link)) || !removedIds.has(link.profile_user_id))

  const participantRows = activeLinks.map((link) => ({
    conversation_id: conversationId,
    profile_id: link.profile_user_id,
    participant_role: canManageTeamRoom(teamRoles(link)) ? 'coordinator' : 'member',
  }))
  if (participantRows.length) {
    await service
      .from('internal_conversation_participants')
      .upsert(participantRows, { onConflict: 'conversation_id,profile_id' })
  }

  const { data: existingRows } = await service
    .from('internal_conversation_participants')
    .select('profile_id,participant_role,muted')
    .eq('conversation_id', conversationId)
  const activeIds = new Set(participantRows.map((row) => row.profile_id))
  const staleIds = ((existingRows ?? []) as ParticipantRow[])
    .map((row) => row.profile_id)
    .filter((id) => !activeIds.has(id))
  if (staleIds.length) {
    await service
      .from('internal_conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .in('profile_id', staleIds)
  }

  const profileById = await loadProfileMap(service, participantRows.map((row) => row.profile_id))
  const participantById = new Map(((existingRows ?? []) as ParticipantRow[]).map((row) => [row.profile_id, row]))
  return activeLinks.map((link) => {
    const profile = profileById.get(link.profile_user_id)
    return {
      id: link.profile_user_id,
      name: profile?.message_display_name?.trim() || profile?.linked_player_name?.trim() || 'Team member',
      playerName: profile?.linked_player_name?.trim() || '',
      roles: teamRoles(link),
      muted: participantById.get(link.profile_user_id)?.muted === true,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

async function notifyTeamRoom(service: SupabaseClient, input: {
  conversationId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  body: string
  announcement: boolean
}) {
  const { data } = await service
    .from('internal_conversation_participants')
    .select('profile_id,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((data ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== input.actorUserId && row.muted !== true)
  if (!recipients.length) return

  const title = input.announcement ? `${input.teamName} announcement` : `New message in ${input.teamName}`
  const href = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
  })
  await service.from('internal_notifications').insert(recipients.map((row) => ({
    recipient_profile_id: row.profile_id,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body: input.body.slice(0, 180),
    href,
    conversation_id: input.conversationId,
  })))
  await sendTeamRoomPush(service, recipients.map((row) => row.profile_id), {
    title,
    body: input.body.slice(0, 180),
    href,
    tag: `team-room-${input.conversationId}`,
  })
}

async function notifyTeamRoomManagers(service: SupabaseClient, input: {
  conversationId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  actorName: string
  response: MatchResponseRow['response']
}) {
  const { data: participants } = await service
    .from('internal_conversation_participants')
    .select('profile_id,participant_role,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((participants ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== input.actorUserId && row.participant_role === 'coordinator' && row.muted !== true)
  if (!recipients.length) return

  const label = input.response === 'yes' ? 'can play' : input.response === 'no' ? 'cannot play' : 'might be able to play'
  const title = `${input.actorName} replied`
  const notificationBody = `${input.actorName} ${label} for ${input.teamName}.`
  const href = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
  })
  await service.from('internal_notifications').insert(recipients.map((row) => ({
    recipient_profile_id: row.profile_id,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body: notificationBody,
    href,
    conversation_id: input.conversationId,
  })))
  await sendTeamRoomPush(service, recipients.map((row) => row.profile_id), {
    title,
    body: notificationBody,
    href,
    tag: `team-room-${input.conversationId}`,
  })
}

async function mirrorAvailabilityResponse(service: SupabaseClient, input: {
  metadata: Record<string, unknown>
  profile: ProfileRow | undefined
  actorName: string
  response: MatchResponseRow['response']
  scope: TeamLinkRow
}) {
  const requestId = cleanText(input.metadata.availabilityRequestId)
  const matchDate = cleanText(input.metadata.matchDate).slice(0, 10)
  if (!matchDate) return

  if (requestId) {
    await service
      .from('captain_availability_request_responses')
      .upsert({
        request_id: requestId,
        player_id: input.profile?.linked_player_id || null,
        player_name: input.actorName,
        match_date: matchDate,
        status: input.response === 'yes' ? 'available' : input.response === 'no' ? 'unavailable' : 'maybe',
        notes: 'Team Room reply',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'request_id,player_name,match_date' })
  }

  if (input.profile?.linked_player_id) {
    await service
      .from('lineup_availability')
      .upsert({
        match_date: matchDate,
        team_name: input.scope.team_name,
        league_name: input.scope.league_name,
        flight: input.scope.flight,
        player_id: input.profile.linked_player_id,
        status: input.response === 'yes' ? 'available' : input.response === 'no' ? 'unavailable' : 'limited',
        notes: input.response === 'maybe' ? 'Maybe — replied in Team Room' : 'Replied in Team Room',
      }, { onConflict: 'match_date,team_name,player_id' })
  }
}

async function loadAcceptedTeamLinks(service: SupabaseClient, userId: string) {
  const { data, error } = await service
    .from('team_profile_links')
    .select('id,profile_user_id,team_name,normalized_team_name,league_name,flight,team_role,team_roles,is_default,updated_at')
    .eq('profile_user_id', userId)
    .eq('status', 'accepted')
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) return { ok: false as const, message: error.message, links: [] as TeamLinkRow[] }
  return { ok: true as const, links: (data ?? []) as TeamLinkRow[] }
}

function selectTeamLink(links: TeamLinkRow[], scope: {
  teamName?: string | null
  leagueName?: string | null
  flight?: string | null
}) {
  const teamKey = normalizeTeamRoomKey(scope.teamName)
  if (!teamKey) return links[0] ?? null
  const teamMatches = links.filter((link) => normalizeTeamRoomKey(link.team_name) === teamKey)
  if (!teamMatches.length) return null
  const requestedScopeId = buildTeamRoomScopeId({
    teamName: scope.teamName || '',
    leagueName: scope.leagueName || '',
    flight: scope.flight || '',
  })
  return teamMatches.find((link) => buildTeamRoomScopeId({
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
  }) === requestedScopeId) ?? teamMatches[0]
}

function toTeamOption(link: TeamLinkRow) {
  return {
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
    roles: teamRoles(link),
    isDefault: link.is_default === true,
    href: buildTeamRoomHref({ teamName: link.team_name, leagueName: link.league_name, flight: link.flight }),
  }
}

function teamRoles(link: TeamLinkRow) {
  const roles = Array.isArray(link.team_roles) ? link.team_roles.filter(Boolean) : []
  return roles.length ? roles : [link.team_role || 'player']
}

async function loadProfileMap(service: SupabaseClient, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (!uniqueIds.length) return new Map<string, ProfileRow>()
  const { data } = await service
    .from('profiles')
    .select('id,message_display_name,linked_player_name,linked_player_id,role')
    .in('id', uniqueIds)
  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
}

function toMessage(
  row: MessageRow,
  profileById: Map<string, ProfileRow>,
  currentUserId: string,
  responses: MatchResponseRow[] = [],
  acknowledgments: LineupAcknowledgmentRow[] = [],
  reminder: ReminderScheduleRow | null = null,
  cardState: 'active' | 'upcoming' | 'archived' | null = null,
  reactions: ReactionRow[] = [],
  attachmentUrl = '',
) {
  const profile = profileById.get(row.sender_user_id)
  const yesCount = responses.filter((item) => item.response === 'yes').length
  const maybeCount = responses.filter((item) => item.response === 'maybe').length
  const noCount = responses.filter((item) => item.response === 'no').length
  const lineupVersion = isMatchCardMetadata(row.metadata)
    ? Math.max(0, Number(row.metadata.lineupVersion) || 0)
    : 0
  const currentAcknowledgments = acknowledgments.filter((item) => item.lineup_version === lineupVersion)
  const card: TeamRoomMessageCardPayload | null = !row.deleted_at && isMatchCardMetadata(row.metadata) ? {
    ...row.metadata,
    lineup: row.metadata.lineup,
    matchDate: cleanText(row.metadata.matchDate),
    state: cardState || 'upcoming',
    lineupVersion,
    lineupChanges: Array.isArray(row.metadata.lineupChanges)
      ? row.metadata.lineupChanges.map((item) => cleanText(item)).filter(Boolean).slice(0, 12)
      : [],
    acknowledged: currentAcknowledgments.some((item) => item.profile_id === currentUserId),
    acknowledgmentSummary: {
      total: currentAcknowledgments.length,
      profileIds: currentAcknowledgments.map((item) => item.profile_id),
    },
    reminder: reminder ? {
      reminderAt: reminder.reminder_at,
      status: reminder.status,
      sentAt: reminder.sent_at || '',
      notificationCount: reminder.notification_count || 0,
    } : null,
  } : null
  const attachment = !row.deleted_at ? cleanAttachmentMetadata(row.metadata) : null
  const reactionSummary = (['ack', 'helpful', 'celebrate'] as const).map((reaction) => {
    const matching = reactions.filter((item) => item.reaction === reaction)
    return {
      reaction,
      count: matching.length,
      profileIds: matching.map((item) => item.profile_id),
      reacted: matching.some((item) => item.profile_id === currentUserId),
    }
  })
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderName: profile?.message_display_name?.trim() || profile?.linked_player_name?.trim() || 'Team member',
    body: row.deleted_at ? 'Message removed.' : row.body,
    kind: row.message_kind === 'announcement'
      ? 'announcement'
      : row.message_kind === 'system' ? 'system' : 'message',
    createdAt: row.created_at || '',
    editedAt: row.edited_at || '',
    deletedAt: row.deleted_at || '',
    isMine: row.sender_user_id === currentUserId,
    replyToMessageId: row.reply_to_message_id || '',
    reactions: reactionSummary,
    attachment: attachment ? { ...attachment, url: attachmentUrl } : null,
    card,
    response: responses.find((item) => item.profile_id === currentUserId)?.response || null,
    responseSummary: { yes: yesCount, maybe: maybeCount, no: noCount, total: responses.length },
    responseDetails: responses.map((item) => ({
      profileId: item.profile_id,
      name: profileById.get(item.profile_id)?.message_display_name?.trim()
        || profileById.get(item.profile_id)?.linked_player_name?.trim()
        || 'Team member',
      response: item.response,
      updatedAt: item.updated_at || '',
    })),
  }
}

async function loadMatchResponses(service: SupabaseClient, messageIds: string[]) {
  const responseByMessageId = new Map<string, MatchResponseRow[]>()
  if (!messageIds.length) return responseByMessageId
  const { data } = await service
    .from('team_room_message_responses')
    .select('message_id,profile_id,response,updated_at')
    .in('message_id', messageIds)
  for (const row of (data ?? []) as MatchResponseRow[]) {
    const current = responseByMessageId.get(row.message_id) || []
    current.push(row)
    responseByMessageId.set(row.message_id, current)
  }
  return responseByMessageId
}

async function applySeasonAvailabilityDefaults(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  matchDate: string
  scope: TeamLinkRow
}) {
  const [preferencesResult, responsesResult] = await Promise.all([
    service
      .from('team_room_member_preferences')
      .select('profile_id,season_availability')
      .eq('conversation_id', input.conversationId)
      .in('season_availability', ['available', 'unavailable']),
    service
      .from('team_room_message_responses')
      .select('profile_id')
      .eq('message_id', input.messageId),
  ])
  const existingIds = new Set(((responsesResult.data ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id))
  const defaults = ((preferencesResult.data ?? []) as Array<{
    profile_id: string
    season_availability: 'available' | 'unavailable'
  }>).filter((row) => !existingIds.has(row.profile_id))
  if (!defaults.length) return

  const now = new Date().toISOString()
  await service.from('team_room_message_responses').insert(defaults.map((row) => ({
    conversation_id: input.conversationId,
    message_id: input.messageId,
    profile_id: row.profile_id,
    response: row.season_availability === 'available' ? 'yes' : 'no',
    created_at: now,
    updated_at: now,
  })))

  const profileById = await loadProfileMap(service, defaults.map((row) => row.profile_id))
  const lineupAvailabilityRows = defaults.flatMap((row) => {
    const linkedPlayerId = profileById.get(row.profile_id)?.linked_player_id?.trim()
    if (!linkedPlayerId) return []
    return [{
      match_date: input.matchDate,
      team_name: input.scope.team_name,
      league_name: input.scope.league_name,
      flight: input.scope.flight,
      player_id: linkedPlayerId,
      status: row.season_availability === 'available' ? 'available' : 'unavailable',
      notes: 'Season availability default from Team Room',
    }]
  })
  if (lineupAvailabilityRows.length) {
    await service
      .from('lineup_availability')
      .upsert(lineupAvailabilityRows, { onConflict: 'match_date,team_name,player_id' })
  }
}

async function loadLineupAcknowledgments(service: SupabaseClient, messageIds: string[]) {
  const ackByMessageId = new Map<string, LineupAcknowledgmentRow[]>()
  if (!messageIds.length) return ackByMessageId
  const { data } = await service
    .from('team_room_lineup_acknowledgments')
    .select('message_id,profile_id,lineup_version,updated_at')
    .in('message_id', messageIds)
  for (const row of (data ?? []) as LineupAcknowledgmentRow[]) {
    const current = ackByMessageId.get(row.message_id) || []
    current.push(row)
    ackByMessageId.set(row.message_id, current)
  }
  return ackByMessageId
}

async function loadReminderSchedules(service: SupabaseClient, messageIds: string[]) {
  const reminderByMessageId = new Map<string, ReminderScheduleRow>()
  if (!messageIds.length) return reminderByMessageId
  const { data } = await service
    .from('team_room_reminder_schedules')
    .select('message_id,reminder_at,status,sent_at,notification_count')
    .in('message_id', messageIds)
  for (const row of (data ?? []) as ReminderScheduleRow[]) reminderByMessageId.set(row.message_id, row)
  return reminderByMessageId
}

async function loadMessageReactions(service: SupabaseClient, messageIds: string[]) {
  const reactionByMessageId = new Map<string, ReactionRow[]>()
  if (!messageIds.length) return reactionByMessageId
  const { data } = await service
    .from('team_room_message_reactions')
    .select('message_id,profile_id,reaction')
    .in('message_id', messageIds)
  for (const row of (data ?? []) as ReactionRow[]) {
    const current = reactionByMessageId.get(row.message_id) || []
    current.push(row)
    reactionByMessageId.set(row.message_id, current)
  }
  return reactionByMessageId
}

async function loadAttachmentUrls(service: SupabaseClient, messages: MessageRow[]) {
  const urlByMessageId = new Map<string, string>()
  await Promise.all(messages.map(async (message) => {
    if (message.deleted_at) return
    const attachment = cleanAttachmentMetadata(message.metadata)
    if (!attachment) return
    const { data } = await service.storage.from(attachment.bucket).createSignedUrl(attachment.path, 60 * 60 * 4)
    if (data?.signedUrl) urlByMessageId.set(message.id, data.signedUrl)
  }))
  return urlByMessageId
}

async function loadTeamRoomManagement(
  service: SupabaseClient,
  userId: string,
  conversationId: string,
  selected: TeamLinkRow,
  members: Array<{ id: string; name: string; playerName: string; roles: string[]; muted: boolean }>,
) {
  const now = new Date().toISOString()
  const [contactsResult, removalsResult, invitesResult] = await Promise.all([
    service
      .from('captain_roster_contacts')
      .select('id,full_name,normalized_name,phone,email,role,league_name,flight')
      .eq('captain_user_id', userId)
      .eq('normalized_team_name', selected.normalized_team_name)
      .order('full_name', { ascending: true })
      .limit(250),
    service
      .from('team_room_member_removals')
      .select('profile_id,removed_at')
      .eq('conversation_id', conversationId)
      .order('removed_at', { ascending: false }),
    service
      .from('team_room_invites')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .is('revoked_at', null)
      .gt('expires_at', now),
  ])

  const memberKeys = new Map<string, string>()
  for (const member of members) {
    for (const value of [member.name, member.playerName]) {
      const key = normalizePersonKey(value)
      if (key) memberKeys.set(key, member.id)
    }
  }
  const rosterMembers = ((contactsResult.data ?? []) as Array<{
    id: string
    full_name: string
    normalized_name: string
    phone: string
    email: string
    role: string
    league_name: string
    flight: string
  }>).filter((contact) => {
    const leagueMatches = !contact.league_name || !selected.league_name
      || normalizeTeamRoomKey(contact.league_name) === normalizeTeamRoomKey(selected.league_name)
    const flightMatches = !contact.flight || !selected.flight
      || normalizeTeamRoomKey(contact.flight) === normalizeTeamRoomKey(selected.flight)
    return leagueMatches && flightMatches
  }).map((contact) => {
    const memberId = memberKeys.get(normalizePersonKey(contact.normalized_name || contact.full_name)) || ''
    return {
      id: contact.id,
      name: contact.full_name,
      phone: contact.phone,
      email: contact.email,
      role: contact.role,
      joined: Boolean(memberId),
      memberId,
    }
  })

  const removedIds = ((removalsResult.data ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id)
  const removedProfileById = await loadProfileMap(service, removedIds)
  const removedMembers = removedIds.map((profileId) => ({
    id: profileId,
    name: removedProfileById.get(profileId)?.message_display_name?.trim()
      || removedProfileById.get(profileId)?.linked_player_name?.trim()
      || 'Team member',
  }))
  return {
    rosterMembers,
    removedMembers,
    activeInviteCount: invitesResult.count || 0,
  }
}

function cleanAttachmentMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).teamRoomAttachment
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const attachment = raw as Record<string, unknown>
  const bucket = cleanText(attachment.bucket)
  const path = cleanText(attachment.path)
  const name = cleanText(attachment.name)
  const mimeType = cleanText(attachment.mimeType)
  const size = Math.max(0, Number(attachment.size) || 0)
  if (bucket !== 'team-room-files' || !path || !name || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) return null
  return { bucket, path, name, mimeType, size }
}

async function loadActionableMatchCard(service: SupabaseClient, conversationId: string, requestedMessageId: string) {
  let query = service
    .from('internal_messages')
    .select('id,metadata,created_at')
    .eq('conversation_id', conversationId)
    .contains('metadata', { teamRoomCard: true })
  if (requestedMessageId) query = query.eq('id', requestedMessageId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(requestedMessageId ? 1 : 300)
  if (error) return { ok: false as const, status: 500, message: error.message }
  const rows = (data ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null; created_at: string | null }>
  const activeId = selectActiveTeamRoomCard(rows.flatMap((row) => (
    isMatchCardMetadata(row.metadata)
      ? [{ id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) }]
      : []
  )))
  const row = requestedMessageId ? rows[0] : rows.find((item) => item.id === activeId)
  if (!row || !isMatchCardMetadata(row.metadata)) {
    return { ok: false as const, status: 404, message: 'This match update is no longer active.' }
  }
  return { ok: true as const, messageId: row.id, metadata: row.metadata }
}

async function buildReminderTargets(
  service: SupabaseClient,
  conversationId: string,
  messageId: string,
  metadata: Record<string, unknown>,
) {
  const [{ data: participants }, responses, acknowledgments] = await Promise.all([
    service
      .from('internal_conversation_participants')
      .select('profile_id,muted')
      .eq('conversation_id', conversationId),
    loadMatchResponses(service, [messageId]).then((rows) => rows.get(messageId) || []),
    loadLineupAcknowledgments(service, [messageId]).then((rows) => rows.get(messageId) || []),
  ])
  const participantRows = ((participants ?? []) as ParticipantRow[]).filter((row) => row.muted !== true)
  const profileById = await loadProfileMap(service, participantRows.map((row) => row.profile_id))
  const responseByProfileId = new Map(responses.map((row) => [row.profile_id, row.response] as const))
  const lineupVersion = Math.max(0, Number(metadata.lineupVersion) || 0)
  const acknowledgedIds = new Set(
    acknowledgments.filter((row) => row.lineup_version === lineupVersion).map((row) => row.profile_id),
  )
  const lineupNameKeys = new Set(normalizeLineupRows(metadata.lineup).flatMap((row) => row.players.map(normalizePersonKey)))

  return participantRows.flatMap((participant): TeamRoomReminderTarget[] => {
    const profile = profileById.get(participant.profile_id)
    const profileNames = [profile?.message_display_name, profile?.linked_player_name]
      .map(normalizePersonKey)
      .filter(Boolean)
    const isLineupPlayer = lineupVersion > 0 && profileNames.some((name) => lineupNameKeys.has(name))
    const needsResponse = !responseByProfileId.has(participant.profile_id)
    const needsMaybeFollowup = responseByProfileId.get(participant.profile_id) === 'maybe'
    const needsAckVersion = isLineupPlayer && !acknowledgedIds.has(participant.profile_id) ? lineupVersion : 0
    return needsResponse || needsMaybeFollowup || needsAckVersion
      ? [{ profileId: participant.profile_id, needsResponse, needsMaybeFollowup, needsAckVersion }]
      : []
  })
}

async function sendTeamRoomReminders(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  matchDate: string
  targets: TeamRoomReminderTarget[]
}) {
  const recipientIds = Array.from(new Set(input.targets.map((target) => target.profileId)))
  if (!recipientIds.length) return []
  const href = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
  })
  const title = `${input.teamName} needs your reply`
  const notificationBody = input.matchDate
    ? `Open the ${input.matchDate} match card to confirm availability or the latest lineup.`
    : 'Open the match card to reply.'
  const { data } = await service.from('internal_notifications').insert(recipientIds.map((profileId) => ({
    recipient_profile_id: profileId,
    actor_user_id: input.actorUserId,
    notification_type: 'schedule',
    title,
    body: notificationBody,
    href,
    conversation_id: input.conversationId,
  }))).select('id')
  await sendTeamRoomPush(service, recipientIds, {
    title,
    body: notificationBody,
    href,
    tag: `team-room-${input.conversationId}`,
  })

  await service.from('internal_messages').insert({
    conversation_id: input.conversationId,
    sender_user_id: input.actorUserId,
    body: `Reminder sent to ${recipientIds.length} teammate${recipientIds.length === 1 ? '' : 's'} who still need to reply.`,
    message_kind: 'system',
    metadata: { teamRoomReminder: true, matchMessageId: input.messageId },
  })
  await service
    .from('internal_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.conversationId)
  return ((data ?? []) as Array<{ id?: string | null }>).map((row) => cleanText(row.id)).filter(Boolean)
}

function buildTeamRoomActionQueue(
  members: Array<{ id: string; name: string; playerName?: string }>,
  message: ReturnType<typeof toMessage> | null,
) {
  const responseById = new Map((message?.responseDetails || []).map((row) => [row.profileId, row.response] as const))
  const waitingMembers = members.filter((member) => !responseById.has(member.id))
  const maybeMembers = members.filter((member) => responseById.get(member.id) === 'maybe')
  const lineup = normalizeLineupRows(message?.card?.lineup)
  const lineupKeys = new Set(lineup.flatMap((row) => row.players.map(normalizePersonKey)))
  const acknowledgedIds = new Set(message?.card?.acknowledgmentSummary.profileIds || [])
  const unseenLineupMembers = Number(message?.card?.lineupVersion || 0) > 0
    ? members.filter((member) => (
        [member.name, member.playerName].map(normalizePersonKey).some((name) => lineupKeys.has(name))
        && !acknowledgedIds.has(member.id)
      ))
    : []
  const unresolvedIds = new Set([
    ...waitingMembers.map((member) => member.id),
    ...maybeMembers.map((member) => member.id),
    ...unseenLineupMembers.map((member) => member.id),
  ])

  return {
    messageId: message?.id || '',
    matchDate: cleanText(message?.card?.matchDate),
    waitingCount: waitingMembers.length,
    waitingNames: waitingMembers.map((member) => member.name),
    maybeCount: maybeMembers.length,
    maybeNames: maybeMembers.map((member) => member.name),
    unseenLineupCount: unseenLineupMembers.length,
    unseenLineupNames: unseenLineupMembers.map((member) => member.name),
    lineupChangeCount: Array.isArray(message?.card?.lineupChanges) ? message.card.lineupChanges.length : 0,
    unresolvedCount: unresolvedIds.size,
    unresolvedProfileIds: Array.from(unresolvedIds),
    reminderAt: cleanText(message?.card?.reminder?.reminderAt),
    reminderStatus: cleanText(message?.card?.reminder?.status),
    lastReminderAt: cleanText(message?.card?.reminder?.sentAt),
  }
}

async function notifyTeamRoomManagersOfLineupAck(service: SupabaseClient, input: {
  conversationId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  actorName: string
}) {
  const { data: participants } = await service
    .from('internal_conversation_participants')
    .select('profile_id,participant_role,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((participants ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== input.actorUserId && row.participant_role === 'coordinator' && row.muted !== true)
  if (!recipients.length) return
  const title = `${input.actorName} saw the lineup`
  const notificationBody = `${input.actorName} acknowledged the latest ${input.teamName} lineup.`
  const href = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
  })
  await service.from('internal_notifications').insert(recipients.map((row) => ({
    recipient_profile_id: row.profile_id,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body: notificationBody,
    href,
    conversation_id: input.conversationId,
  })))
  await sendTeamRoomPush(service, recipients.map((row) => row.profile_id), {
    title,
    body: notificationBody,
    href,
    tag: `team-room-${input.conversationId}`,
  })
}

function normalizePersonKey(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isMatchCardMetadata(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const cardType = cleanText((value as Record<string, unknown>).cardType)
  return (value as Record<string, unknown>).teamRoomCard === true
    && ['availability', 'projected_lineup'].includes(cardType)
}

function cleanMatchCard(value: unknown) {
  const card = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const lineup = normalizeLineupRows(card.lineup)

  return {
    cardType: cleanText(card.cardType) === 'projected_lineup' ? 'projected_lineup' : 'availability',
    title: cleanText(card.title).slice(0, 120) || 'Can you play?',
    matchDate: cleanText(card.matchDate).slice(0, 10),
    opponent: cleanText(card.opponent).slice(0, 160),
    matchTime: cleanText(card.matchTime).slice(0, 80),
    facility: cleanText(card.facility).slice(0, 240),
    lineup,
    availabilityRequestId: cleanText(card.availabilityRequestId),
    availabilityRequestUrl: cleanText(card.availabilityRequestUrl).slice(0, 500),
  }
}

async function getTeamRoomAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to open your Team Room.' }, { status: 401 }) }
  }
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to open your Team Room.' }, { status: 401 }) }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Team Rooms are not configured yet.' }, { status: 503 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { ok: true as const, service, userId: data.user.id }
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice('bearer '.length).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
