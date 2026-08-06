import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildTeamRoomHref,
  buildTeamRoomScopeId,
  canManageTeamRoom,
  normalizeTeamRoomKey,
} from '@/lib/team-room'
import {
  buildLineupChangeNotice,
  buildLineupChanges,
  buildTeamRoomCourtReadiness,
  canRespondToLineupChange,
  getLineupChangeReminderAt,
  normalizeLineupRows,
  parseReminderTargets,
  selectActiveTeamRoomCard,
  selectLatestPastTeamRoomCard,
  teamRoomCardState,
  todayDateKey,
  type TeamRoomReminderTarget,
} from '@/lib/team-room-match-flow'
import { loadCaptainResumeNextMatchForScope } from '@/lib/platform-resume-next-match'
import {
  summarizeTeamRoomAvailability,
  type TeamRoomAvailabilitySummary,
} from '@/lib/team-room-availability'
import { buildCaptainReplyNotification, findCaptainReplyCourt } from '@/lib/captain-reply-alert'
import {
  buildCaptainLockedLineupAnnouncement,
  buildCaptainLockedLineupId,
  isCaptainLineupLocked,
} from '@/lib/captain-lineup-confirmation'
import { sendTeamRoomPush } from '@/lib/team-room-push-server'
import {
  buildPublishedLineupChangeAnnouncement,
  buildTeamRoomFinalLineupReview,
  buildTeamRoomFinalLineupReceipt,
  readTeamRoomLineupAnnouncement,
  readTeamRoomFinalLineupReceipt,
} from '@/lib/team-room-final-lineup'
import {
  buildCaptainLevelUpCardHref,
  buildCaptainLevelUpChallenge,
  getCaptainLevelUpCompletedCardIdsByPlayer,
  getCaptainLevelUpCompletedPlayerIdsForRun,
  selectActiveCaptainLevelUpChallenge,
  sortCaptainLevelUpChallengeResumes,
  type CaptainLevelUpChallenge,
} from '@/lib/captain-level-up-challenge'
import {
  buildTeamRoomFinalResult,
  buildTeamRoomFinalResultLines,
  getTeamRoomMatchSide,
  selectTeamRoomCompletedMatch,
  type TeamRoomCompletedLineMatch,
  type TeamRoomCompletedMatch,
  type TeamRoomLinePlayer,
  type TeamRoomPlayerName,
} from '@/lib/team-room-final-result'
import {
  clearTeamRoomArrivalCheckInsForPlayer,
  findTeamRoomAssignedCourt,
  isTeamRoomArrivalStatus,
  keepTeamRoomArrivalCheckInsForLineup,
  readTeamRoomArrivalCheckIns,
  teamRoomArrivalStatusLabel,
  upsertTeamRoomArrivalCheckIn,
} from '@/lib/team-room-arrival'

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
  availabilitySummary: TeamRoomAvailabilitySummary | null
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
  silent?: unknown
  changeContext?: unknown
  deadlineDate?: unknown
  challengeId?: unknown
  matchDate?: unknown
  lineupId?: unknown
  arrivalStatus?: unknown
  playerName?: unknown
}

type TeamRoomLevelUpChallengePayload = {
  id: string
  title: string
  focus: string
  detail: string
  cardIds: string[]
  completedCardIds: string[]
  completed: boolean
  completedCount: number
  connectedCount: number
  status: 'active' | 'scheduled' | 'cancelled' | 'closed'
  scheduledForDate: string
}

type TeamRoomActiveChallengeSummary = {
  messageId: string
  id: string
  title: string
  focus: string
  teamName: string
  leagueName: string
  flight: string
  cardIds: string[]
  completedCardIds: string[]
  completed: boolean
  completedCount: number
  connectedCount: number
  launchedAt: string
  resumeHref: string
  teamRoomHref: string
}

type StoredLineupChangeNotice = {
  courtLabel: string
  outgoingPlayerName: string
  replacementPlayerName: string
  affectedNames: string[]
  beforePlayers: string[]
  afterPlayers: string[]
  pending: boolean
  notifiedAt: string
  notifiedCount: number
  response: '' | 'accepted' | 'declined'
  respondedAt: string
  responderProfileId: string
  responderName: string
  deadlineAt: string
  deadlineStatus: '' | 'scheduled' | 'reminded' | 'answered'
  reminderSentAt: string
  publishedLineupChange: boolean
  previousFinalLineupId: string
  publishedAnnouncementMessageId: string
  publishedAt: string
  publishedByUserId: string
  publishedByName: string
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

  if (url.searchParams.get('activeChallenge') === '1') {
    const activeChallengeResult = await loadBestActiveTeamChallenge(
      auth.service,
      auth.userId,
      linksResult.links,
    )
    if (!activeChallengeResult.ok) {
      return Response.json(
        { ok: false, message: activeChallengeResult.message },
        { status: activeChallengeResult.status },
      )
    }
    return Response.json({
      ok: true,
      summary: {
        activeChallenge: activeChallengeResult.activeChallenge,
        activeChallenges: activeChallengeResult.activeChallenges,
      },
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

  const challengeId = url.searchParams.get('levelUpChallenge')?.trim() || ''
  if (challengeId) {
    const challenge = buildCaptainLevelUpChallenge(challengeId)
    if (!challenge) return Response.json({ ok: false, message: 'Choose a valid Level Up challenge.' }, { status: 400 })
    const progressResult = await loadTeamLevelUpChallengeProgress(auth.service, auth.userId, selected, challenge)
    if (!progressResult.ok) {
      return Response.json({ ok: false, message: progressResult.message }, { status: progressResult.status })
    }
    return Response.json({ ok: true, progress: progressResult.progress })
  }

  if (url.searchParams.get('levelUpHistory') === '1') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can review team challenge history.' }, { status: 403 })
    }
    const historyResult = await loadTeamLevelUpChallengeHistory(auth.service, auth.userId, selected)
    if (!historyResult.ok) {
      return Response.json({ ok: false, message: historyResult.message }, { status: historyResult.status })
    }
    return Response.json({ ok: true, history: historyResult.history })
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
  if (
    action === 'set_arrival_status'
    || action === 'set_player_arrival_status'
    || action === 'clear_player_arrival_status'
  ) {
    const clearingPlayerStatus = action === 'clear_player_arrival_status'
    const captainManaged = action === 'set_player_arrival_status' || clearingPlayerStatus
    const arrivalStatus = isTeamRoomArrivalStatus(body.arrivalStatus) ? body.arrivalStatus : null
    if (!clearingPlayerStatus && !arrivalStatus) {
      return Response.json({ ok: false, message: 'Choose On my way, Here, or Running late.' }, { status: 400 })
    }
    if (captainManaged && !canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can update a teammate\'s arrival.' }, { status: 403 })
    }
    if (captainManaged && arrivalStatus === 'running_late') {
      return Response.json({ ok: false, message: 'Players set their own running-late status.' }, { status: 400 })
    }
    const requestedMessageId = cleanText(body.messageId)
    let cardResult = await loadActionableMatchCard(auth.service, conversation.id, '')
    if (!cardResult.ok) {
      return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    }
    if (!requestedMessageId || requestedMessageId !== cardResult.messageId) {
      return Response.json({ ok: false, message: 'Open the current match plan before checking in.' }, { status: 409 })
    }
    const member = syncedMembers.find((item) => item.id === auth.userId)
    if (!member) {
      return Response.json({ ok: false, message: 'You are no longer connected to this team.' }, { status: 403 })
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const receipt = readTeamRoomFinalLineupReceipt(cardResult.metadata.finalLineup)
      if (!receipt || receipt.sourceMessageId !== cardResult.messageId) {
        return Response.json({ ok: false, message: 'The captain has not sent this lineup yet.' }, { status: 409 })
      }
      if (cleanText(cardResult.metadata.matchCompletedAt)) {
        return Response.json({ ok: false, message: 'This match is complete.' }, { status: 409 })
      }
      const lineup = normalizeLineupRows(cardResult.metadata.lineup)
      const requestedPlayerKey = normalizePersonKey(body.playerName)
      const captainAssignment = captainManaged && requestedPlayerKey
        ? lineup.flatMap((court, index) => court.players.map((playerName) => ({
            courtLabel: court.label.trim() || `Court ${index + 1}`,
            playerName,
          }))).find((item) => normalizePersonKey(item.playerName) === requestedPlayerKey) || null
        : null
      const assignment = captainManaged
        ? captainAssignment
        : findTeamRoomAssignedCourt(lineup, [member.playerName, member.name])
      if (!assignment) {
        return Response.json({
          ok: false,
          message: captainManaged ? 'That player is not assigned to this lineup.' : 'Your name is not assigned to this lineup.',
        }, { status: captainManaged ? 400 : 403 })
      }
      const connectedPlayer = captainManaged
        ? syncedMembers.find((item) => [item.playerName, item.name]
            .some((name) => normalizePersonKey(name) === normalizePersonKey(assignment.playerName)))
        : member
      const checkInProfileId = connectedPlayer?.id
        || `captain:${normalizePersonKey(assignment.playerName).slice(0, 110)}`
      const existing = readTeamRoomArrivalCheckIns(cardResult.metadata.arrivalCheckIns)
      const clearedCheckIns = clearingPlayerStatus
        ? clearTeamRoomArrivalCheckInsForPlayer(existing, assignment.playerName)
        : existing
      if (clearingPlayerStatus && clearedCheckIns.length === existing.length) {
        return Response.json({ ok: true, alreadySaved: true, cleared: true })
      }
      const prior = existing.find((item) => item.profileId === checkInProfileId)
      if (
        !clearingPlayerStatus
        && prior?.status === arrivalStatus
        && prior.playerName === assignment.playerName
        && prior.courtLabel === assignment.courtLabel
      ) {
        return Response.json({ ok: true, alreadySaved: true, checkIn: prior })
      }

      const updatedAt = new Date().toISOString()
      const checkIn = !clearingPlayerStatus && arrivalStatus ? {
        profileId: checkInProfileId,
        playerName: assignment.playerName,
        courtLabel: assignment.courtLabel,
        status: arrivalStatus,
        updatedAt,
        setByCaptain: captainManaged,
      } : null
      const claimedMetadata = {
        ...cardResult.metadata,
        arrivalCheckIns: checkIn
          ? upsertTeamRoomArrivalCheckIn(existing, checkIn)
          : clearedCheckIns,
      }
      const updateResult = await auth.service
        .from('internal_messages')
        .update({ metadata: claimedMetadata, edited_at: updatedAt })
        .eq('id', cardResult.messageId)
        .eq('conversation_id', conversation.id)
        .filter('metadata', 'eq', JSON.stringify(cardResult.metadata))
        .select('id')
        .maybeSingle()
      if (updateResult.error) {
        return Response.json({ ok: false, message: updateResult.error.message }, { status: 500 })
      }
      if (updateResult.data) {
        await auth.service.from('internal_conversations').update({ updated_at: updatedAt }).eq('id', conversation.id)
        if (!captainManaged && arrivalStatus === 'running_late') {
          await notifyManagersOfArrivalStatus(auth.service, {
            conversationId: conversation.id,
            messageId: cardResult.messageId,
            actorUserId: auth.userId,
            actorName: assignment.playerName,
            courtLabel: assignment.courtLabel,
            scope: selected,
            managerIds: syncedMembers
              .filter((item) => item.id !== auth.userId && !item.muted && canManageTeamRoom(item.roles))
              .map((item) => item.id),
          })
        }
        return Response.json(checkIn
          ? { ok: true, alreadySaved: false, checkIn }
          : { ok: true, alreadySaved: false, cleared: true })
      }

      cardResult = await loadActionableMatchCard(auth.service, conversation.id, '')
      if (!cardResult.ok) {
        return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
      }
      if (cardResult.messageId !== requestedMessageId) {
        return Response.json({ ok: false, message: 'The active match changed. Open its match plan before checking in.' }, { status: 409 })
      }
    }
    return Response.json({ ok: false, message: 'Arrival statuses changed. Try once more.' }, { status: 409 })
  }

  if (action === 'complete_match_day') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can close the match.' }, { status: 403 })
    }
    const lineupResult = await loadCurrentFinalLineupAction(
      auth.service,
      conversation.id,
      cleanText(body.messageId),
    )
    if (!lineupResult.ok) {
      return Response.json({ ok: false, message: lineupResult.message }, { status: lineupResult.status })
    }
    const existingCompletedAt = cleanText(lineupResult.card.metadata.matchCompletedAt)
    if (existingCompletedAt) {
      return Response.json({ ok: true, alreadyCompleted: true, matchCompletedAt: existingCompletedAt })
    }
    const matchCompletedAt = new Date().toISOString()
    const claimedMetadata = {
      ...lineupResult.card.metadata,
      matchCompletedAt,
      matchCompletedByUserId: auth.userId,
    }
    const { data, error } = await auth.service
      .from('internal_messages')
      .update({ metadata: claimedMetadata })
      .eq('id', lineupResult.card.messageId)
      .eq('conversation_id', conversation.id)
      .filter('metadata', 'eq', JSON.stringify(lineupResult.card.metadata))
      .select('id')
      .maybeSingle()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    if (!data) {
      const currentResult = await loadCurrentFinalLineupAction(auth.service, conversation.id, lineupResult.announcement.id)
      const currentCompletedAt = currentResult.ok ? cleanText(currentResult.card.metadata.matchCompletedAt) : ''
      if (currentCompletedAt) {
        return Response.json({ ok: true, alreadyCompleted: true, matchCompletedAt: currentCompletedAt })
      }
      return Response.json({ ok: false, message: 'The match changed. Refresh before closing it.' }, { status: 409 })
    }
    return Response.json({ ok: true, alreadyCompleted: false, matchCompletedAt })
  }

  if (action === 'send_final_lineup') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can send the final lineup.' }, { status: 403 })
    }
    const requestedMessageId = cleanText(body.messageId)
    const requestedLineupId = cleanText(body.lineupId)
    if (!requestedMessageId || !requestedLineupId) {
      return Response.json({ ok: false, message: 'Refresh the lineup before sending it.' }, { status: 400 })
    }

    const summaryResult = await loadTeamRoomSummary(auth.service, auth.userId, selected)
    if (!summaryResult.ok) {
      return Response.json({ ok: false, message: summaryResult.message }, { status: summaryResult.status })
    }
    const readiness = summaryResult.summary.courtReadiness
    const lineup = readiness.lineup
    const serverLineupId = buildCaptainLockedLineupId({ messageId: readiness.messageId, lineup })
    if (
      readiness.messageId !== requestedMessageId
      || serverLineupId !== requestedLineupId
      || !isCaptainLineupLocked({
        confirmedCount: readiness.confirmedCount,
        totalCount: readiness.totalCount,
        lineup,
      })
    ) {
      return Response.json({ ok: false, message: 'The lineup changed. Refresh before sending the final update.' }, { status: 409 })
    }
    if (readiness.finalLineup?.lineupId === serverLineupId) {
      return Response.json({ ok: true, alreadySent: true, finalLineup: readiness.finalLineup })
    }

    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, requestedMessageId)
    if (!cardResult.ok) {
      return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    }
    const existingReceipt = readTeamRoomFinalLineupReceipt(cardResult.metadata.finalLineup)
    if (existingReceipt?.lineupId === serverLineupId) {
      return Response.json({ ok: true, alreadySent: true, finalLineup: existingReceipt })
    }
    const messageBody = buildCaptainLockedLineupAnnouncement({
      lineup,
      matchDate: cleanText(cardResult.metadata.matchDate),
      opponent: cleanText(cardResult.metadata.opponent),
      arrivalTime: cleanText(cardResult.metadata.matchTime),
      facility: cleanText(cardResult.metadata.facility),
    }).slice(0, 2400)

    const sentAt = new Date().toISOString()
    const announcementMessageId = crypto.randomUUID()
    const senderName = syncedMembers.find((member) => member.id === auth.userId)?.name || 'Team captain'
    const finalLineup = buildTeamRoomFinalLineupReceipt({
      lineupId: serverLineupId,
      sourceMessageId: requestedMessageId,
      announcementMessageId,
      sentAt,
      sentByUserId: auth.userId,
      sentByName: senderName,
    })
    const claimedMetadata = { ...cardResult.metadata, finalLineup }
    const claimResult = await auth.service
      .from('internal_messages')
      .update({ metadata: claimedMetadata })
      .eq('id', requestedMessageId)
      .eq('conversation_id', conversation.id)
      .filter('metadata', 'eq', JSON.stringify(cardResult.metadata))
      .select('id')
      .maybeSingle()
    if (claimResult.error) return Response.json({ ok: false, message: claimResult.error.message }, { status: 500 })
    if (!claimResult.data) {
      const currentCard = await loadActionableMatchCard(auth.service, conversation.id, requestedMessageId)
      const currentReceipt = currentCard.ok
        ? readTeamRoomFinalLineupReceipt(currentCard.metadata.finalLineup)
        : null
      if (currentReceipt?.lineupId === serverLineupId) {
        return Response.json({ ok: true, alreadySent: true, finalLineup: currentReceipt })
      }
      return Response.json({ ok: false, message: 'The lineup changed. Refresh before sending the final update.' }, { status: 409 })
    }

    const { data: message, error } = await auth.service
      .from('internal_messages')
      .insert({
        id: announcementMessageId,
        conversation_id: conversation.id,
        sender_user_id: auth.userId,
        body: messageBody,
        message_kind: 'announcement',
        metadata: {
          finalLineupAnnouncement: true,
          lineupId: serverLineupId,
          sourceMessageId: requestedMessageId,
        },
      })
      .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
      .single()
    if (error) {
      await auth.service
        .from('internal_messages')
        .update({ metadata: cardResult.metadata })
        .eq('id', requestedMessageId)
        .eq('conversation_id', conversation.id)
        .filter('metadata', 'eq', JSON.stringify(claimedMetadata))
      return Response.json({ ok: false, message: error.message }, { status: 500 })
    }

    await auth.service
      .from('internal_conversations')
      .update({ updated_at: sentAt })
      .eq('id', conversation.id)
    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: messageBody,
      announcement: true,
    })

    return Response.json({
      ok: true,
      alreadySent: false,
      finalLineup,
      message: toMessage(message as MessageRow, new Map(), auth.userId),
    })
  }

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

  if (action === 'post_level_up_challenge') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can share a team challenge.' }, { status: 403 })
    }
    const challenge = buildCaptainLevelUpChallenge(cleanText(body.challengeId))
    if (!challenge) {
      return Response.json({ ok: false, message: 'Choose a valid Level Up challenge.' }, { status: 400 })
    }
    const launchedAt = new Date().toISOString()
    const closeResult = await closeOpenLevelUpChallenges(auth.service, conversation.id, launchedAt)
    if (!closeResult.ok) {
      return Response.json({ ok: false, message: closeResult.message }, { status: 500 })
    }
    const { data: message, error } = await auth.service
      .from('internal_messages')
      .insert({
        conversation_id: conversation.id,
        sender_user_id: auth.userId,
        body: `${challenge.title}: ${challenge.focus}`,
        message_kind: 'announcement',
        metadata: {
          teamLevelUpChallenge: true,
          challengeId: challenge.id,
          cardIds: challenge.cardIds,
          launchedAt,
        },
      })
      .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

    await auth.service
      .from('internal_conversations')
      .update({ updated_at: launchedAt })
      .eq('id', conversation.id)
    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: `${challenge.title} is ready. Open the team challenge and complete all ${challenge.cardIds.length} cards.`,
      announcement: true,
    })

    return Response.json({
      ok: true,
      message: toMessage(message as MessageRow, new Map(), auth.userId),
      progress: {
        launched: true,
        completedCount: 0,
        connectedCount: syncedMembers.length,
        launchedAt,
        messageId: cleanText(message?.id),
      },
    })
  }

  if (action === 'schedule_level_up_challenge') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can schedule a team challenge.' }, { status: 403 })
    }
    const challenge = buildCaptainLevelUpChallenge(cleanText(body.challengeId))
    if (!challenge) {
      return Response.json({ ok: false, message: 'Choose a valid Level Up challenge.' }, { status: 400 })
    }
    const scheduledForDate = cleanChallengeMatchDate(body.matchDate)
    if (!scheduledForDate) {
      return Response.json({ ok: false, message: 'Choose the match week first.' }, { status: 400 })
    }
    const scheduledAt = new Date().toISOString()
    const closeResult = await closeScheduledLevelUpChallengesForDate(
      auth.service,
      conversation.id,
      scheduledForDate,
      scheduledAt,
    )
    if (!closeResult.ok) return Response.json({ ok: false, message: closeResult.message }, { status: 500 })

    const { data: message, error } = await auth.service
      .from('internal_messages')
      .insert({
        conversation_id: conversation.id,
        sender_user_id: auth.userId,
        body: `${challenge.title} is scheduled for ${scheduledForDate}.`,
        message_kind: 'announcement',
        metadata: {
          teamLevelUpChallenge: true,
          challengeId: challenge.id,
          cardIds: challenge.cardIds,
          challengeStatus: 'scheduled',
          scheduledForDate,
          scheduledAt,
        },
      })
      .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    await auth.service
      .from('internal_conversations')
      .update({ updated_at: scheduledAt })
      .eq('id', conversation.id)
    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: `${challenge.title} is planned for the ${scheduledForDate} match week. The captain will start it when the team is ready.`,
      announcement: true,
    })
    return Response.json({
      ok: true,
      message: toMessage(message as MessageRow, new Map(), auth.userId),
      scheduledForDate,
    })
  }

  if (action === 'activate_level_up_challenge' || action === 'cancel_level_up_challenge') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can manage a scheduled challenge.' }, { status: 403 })
    }
    const scheduledResult = await loadScheduledLevelUpChallenge(
      auth.service,
      conversation.id,
      cleanText(body.messageId),
    )
    if (!scheduledResult.ok) {
      return Response.json({ ok: false, message: scheduledResult.message }, { status: scheduledResult.status })
    }
    const now = new Date().toISOString()
    if (action === 'cancel_level_up_challenge') {
      const { error } = await auth.service
        .from('internal_messages')
        .update({
          body: `${scheduledResult.challenge.title} schedule cancelled.`,
          metadata: { ...scheduledResult.metadata, challengeStatus: 'closed', closedAt: now },
        })
        .eq('id', scheduledResult.messageId)
        .eq('conversation_id', conversation.id)
      if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
      await notifyTeamRoom(auth.service, {
        conversationId: conversation.id,
        actorUserId: auth.userId,
        teamName: selected.team_name,
        scope: selected,
        body: `${scheduledResult.challenge.title} is no longer planned for this match week.`,
        announcement: true,
      })
      return Response.json({ ok: true, status: 'closed' })
    }

    const closeResult = await closeOpenLevelUpChallenges(auth.service, conversation.id, now)
    if (!closeResult.ok) return Response.json({ ok: false, message: closeResult.message }, { status: 500 })
    const activeMetadata = {
      ...scheduledResult.metadata,
      challengeStatus: 'active',
      launchedAt: now,
      activatedAt: now,
    }
    const { data: message, error } = await auth.service
      .from('internal_messages')
      .update({
        body: `${scheduledResult.challenge.title}: ${scheduledResult.challenge.focus}`,
        metadata: activeMetadata,
      })
      .eq('id', scheduledResult.messageId)
      .eq('conversation_id', conversation.id)
      .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    await auth.service
      .from('internal_conversations')
      .update({ updated_at: now })
      .eq('id', conversation.id)
    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: `${scheduledResult.challenge.title} is ready. Open the team challenge and complete all ${scheduledResult.challenge.cardIds.length} cards.`,
      announcement: true,
    })
    return Response.json({
      ok: true,
      message: toMessage(message as MessageRow, new Map(), auth.userId),
      progress: {
        launched: true,
        completedCount: 0,
        connectedCount: syncedMembers.length,
        launchedAt: now,
        messageId: scheduledResult.messageId,
      },
    })
  }

  if (action === 'remind_level_up_challenge') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can send challenge reminders.' }, { status: 403 })
    }
    const challengeResult = await loadActionableLevelUpChallenge(
      auth.service,
      conversation.id,
      cleanText(body.messageId),
      syncedMembers,
    )
    if (!challengeResult.ok) {
      return Response.json({ ok: false, message: challengeResult.message }, { status: challengeResult.status })
    }
    const incompleteMembers = syncedMembers.filter((member) => (
      member.id !== auth.userId
      && !challengeResult.completedIds.has(member.id)
    ))
    const targets = incompleteMembers.filter((member) => member.muted !== true)
    if (!targets.length) {
      return Response.json({
        ok: true,
        notificationIds: [],
        targetCount: 0,
        incompleteCount: incompleteMembers.length,
      })
    }

    const notificationIds = await sendTeamLevelUpChallengeReminders(auth.service, {
      conversationId: conversation.id,
      messageId: challengeResult.message.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      challenge: challengeResult.challenge,
      recipientIds: targets.map((member) => member.id),
    })
    return Response.json({
      ok: true,
      notificationIds,
      targetCount: targets.length,
      incompleteCount: incompleteMembers.length,
    })
  }

  if (action === 'complete_level_up_challenge') {
    const challengeResult = await loadActionableLevelUpChallenge(
      auth.service,
      conversation.id,
      cleanText(body.messageId),
      syncedMembers,
    )
    if (!challengeResult.ok) {
      return Response.json({ ok: false, message: challengeResult.message }, { status: challengeResult.status })
    }
    if (challengeResult.completedIds.has(auth.userId)) {
      return Response.json({ ok: true, completed: true })
    }
    const { error } = await auth.service
      .from('team_room_message_reactions')
      .upsert({
        conversation_id: conversation.id,
        message_id: challengeResult.message.id,
        profile_id: auth.userId,
        reaction: 'ack',
      }, { onConflict: 'message_id,profile_id,reaction', ignoreDuplicates: true })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, completed: true })
  }

  if (action === 'close_level_up_challenge') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can end a team challenge.' }, { status: 403 })
    }
    const messageId = cleanText(body.messageId)
    const { data: message, error: messageError } = await auth.service
      .from('internal_messages')
      .select('id,metadata')
      .eq('id', messageId)
      .eq('conversation_id', conversation.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (messageError) return Response.json({ ok: false, message: messageError.message }, { status: 500 })
    if (!message || !isLevelUpChallengeMetadata(message.metadata as Record<string, unknown> | null)) {
      return Response.json({ ok: false, message: 'This team challenge is no longer available.' }, { status: 404 })
    }
    const closeResult = await closeOpenLevelUpChallenges(auth.service, conversation.id, new Date().toISOString())
    if (!closeResult.ok) return Response.json({ ok: false, message: closeResult.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'post_match_card') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can post a match update.' }, { status: 403 })
    }
    const card = cleanMatchCard(body.card)
    const silent = body.silent === true
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
      : card.cardType === 'projected_lineup' && previousCard?.cardType === 'projected_lineup'
        ? {
            ...card,
            opponent: card.opponent || previousCard.opponent,
            matchTime: card.matchTime || previousCard.matchTime,
            facility: card.facility || previousCard.facility,
            availabilityRequestId: card.availabilityRequestId || previousCard.availabilityRequestId,
            availabilityRequestUrl: card.availabilityRequestUrl || previousCard.availabilityRequestUrl,
          }
        : card
    const lineupChanges = effectiveCard.cardType === 'projected_lineup'
      ? buildLineupChanges(previousCard?.lineup || [], effectiveCard.lineup)
      : []
    const previousLineupVersion = Math.max(0, Number(existingRows?.[0]?.metadata?.lineupVersion) || 0)
    const lineupVersion = effectiveCard.cardType === 'projected_lineup'
      ? Math.max(1, previousLineupVersion + (lineupChanges.length && previousLineupVersion ? 1 : 0))
      : 0
    const changeContext = cleanLineupChangeContext(body.changeContext)
    const lineupChangeNotice = silent && previousCard && changeContext
      ? buildLineupChangeNotice(previousCard.lineup, effectiveCard.lineup, changeContext)
      : null
    const previousFinalLineup = readTeamRoomFinalLineupReceipt(existingRows?.[0]?.metadata?.finalLineup)
    const previousLineupChange = cleanStoredLineupChangeNotice(existingRows?.[0]?.metadata?.lineupChangeNotice)
    const previousPublishedLineupId = previousFinalLineup?.lineupId || previousLineupChange?.previousFinalLineupId || ''
    const changesPublishedLineup = Boolean(previousPublishedLineupId && lineupChangeNotice && lineupChanges.length)
    const preservesPublishedLineup = Boolean(existingId && previousCard && buildCaptainLockedLineupId({
      messageId: existingId,
      lineup: previousCard.lineup,
    }) === buildCaptainLockedLineupId({
      messageId: existingId,
      lineup: effectiveCard.lineup,
    }))
    const metadata = {
      ...effectiveCard,
      teamRoomCard: true,
      lineupVersion,
      lineupChanges,
      lineupChangedAt: lineupChanges.length ? new Date().toISOString() : cleanText(existingRows?.[0]?.metadata?.lineupChangedAt),
      lineupChangeNotice: lineupChangeNotice ? {
        ...lineupChangeNotice,
        pending: true,
        notifiedAt: '',
        notifiedCount: 0,
        response: '',
        respondedAt: '',
        responderProfileId: '',
        responderName: '',
        deadlineAt: '',
        deadlineStatus: '',
        reminderSentAt: '',
        publishedLineupChange: changesPublishedLineup,
        previousFinalLineupId: changesPublishedLineup ? previousPublishedLineupId : '',
        publishedAnnouncementMessageId: '',
        publishedAt: '',
        publishedByUserId: '',
        publishedByName: '',
      } : null,
      finalLineup: preservesPublishedLineup
        ? readTeamRoomFinalLineupReceipt(existingRows?.[0]?.metadata?.finalLineup)
        : null,
      arrivalCheckIns: existingId
        ? keepTeamRoomArrivalCheckInsForLineup(
            effectiveCard.lineup,
            existingRows?.[0]?.metadata?.arrivalCheckIns,
          )
        : [],
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
    if (!silent) {
      await notifyTeamRoom(auth.service, {
        conversationId: conversation.id,
        actorUserId: auth.userId,
        teamName: selected.team_name,
        scope: selected,
        body: cardBody,
        announcement: true,
      })
    }

    return Response.json({
      ok: true,
      messageId: writeResult.data.id,
      silent,
      lineupChangeNotice,
      href: buildTeamRoomHref({
        teamName: selected.team_name,
        leagueName: selected.league_name,
        flight: selected.flight,
        date: card.matchDate,
        opponent: effectiveCard.opponent,
        time: effectiveCard.matchTime,
        facility: effectiveCard.facility,
      }),
    })
  }

  if (action === 'notify_lineup_change') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can send a lineup change.' }, { status: 403 })
    }
    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, cleanText(body.messageId))
    if (!cardResult.ok) return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    const changeNotice = cleanStoredLineupChangeNotice(cardResult.metadata.lineupChangeNotice)
    if (!changeNotice) {
      return Response.json({ ok: false, message: 'There is no saved lineup change waiting to be sent.' }, { status: 409 })
    }
    if (!changeNotice.pending) {
      return Response.json({
        ok: true,
        alreadyNotified: true,
        notifiedCount: changeNotice.notifiedCount,
        directShareNames: [],
        shareText: buildLineupChangeShareText(changeNotice),
        publishedLineupChange: changeNotice.publishedLineupChange,
      })
    }

    const notifiedAt = new Date().toISOString()
    const publishedAnnouncementMessageId = changeNotice.publishedLineupChange ? crypto.randomUUID() : ''
    const publishedByName = syncedMembers.find((member) => member.id === auth.userId)?.name || 'Team captain'
    const nextNotice: StoredLineupChangeNotice = {
      ...changeNotice,
      pending: false,
      notifiedAt,
      notifiedCount: 0,
      publishedAnnouncementMessageId,
      publishedAt: changeNotice.publishedLineupChange ? notifiedAt : '',
      publishedByUserId: changeNotice.publishedLineupChange ? auth.userId : '',
      publishedByName: changeNotice.publishedLineupChange ? publishedByName : '',
    }
    const claimedMetadata = { ...cardResult.metadata, lineupChangeNotice: nextNotice }
    const claimResult = await auth.service
      .from('internal_messages')
      .update({
        metadata: claimedMetadata,
        edited_at: notifiedAt,
      })
      .eq('id', cardResult.messageId)
      .eq('conversation_id', conversation.id)
      .filter('metadata', 'eq', JSON.stringify(cardResult.metadata))
      .select('id')
      .maybeSingle()
    if (claimResult.error) return Response.json({ ok: false, message: claimResult.error.message }, { status: 500 })
    if (!claimResult.data) {
      const currentCard = await loadActionableMatchCard(auth.service, conversation.id, cardResult.messageId)
      const currentNotice = currentCard.ok
        ? cleanStoredLineupChangeNotice(currentCard.metadata.lineupChangeNotice)
        : null
      if (currentNotice && !currentNotice.pending) {
        return Response.json({
          ok: true,
          alreadyNotified: true,
          notifiedCount: currentNotice.notifiedCount,
          directShareNames: [],
          shareText: buildLineupChangeShareText(currentNotice),
          publishedLineupChange: currentNotice.publishedLineupChange,
        })
      }
      return Response.json({ ok: false, message: 'The lineup changed. Refresh before sending this update.' }, { status: 409 })
    }

    if (changeNotice.publishedLineupChange) {
      const announcementBody = buildPublishedLineupChangeAnnouncement({
        ...changeNotice,
        matchDate: cleanText(cardResult.metadata.matchDate),
        opponent: cleanText(cardResult.metadata.opponent),
      })
      const announcementResult = await auth.service
        .from('internal_messages')
        .insert({
          id: publishedAnnouncementMessageId,
          conversation_id: conversation.id,
          sender_user_id: auth.userId,
          body: announcementBody,
          message_kind: 'announcement',
          metadata: {
            finalLineupChangeAnnouncement: true,
            sourceMessageId: cardResult.messageId,
            previousFinalLineupId: changeNotice.previousFinalLineupId,
            courtLabel: changeNotice.courtLabel,
          },
        })
      if (announcementResult.error) {
        await auth.service
          .from('internal_messages')
          .update({ metadata: cardResult.metadata, edited_at: new Date().toISOString() })
          .eq('id', cardResult.messageId)
          .eq('conversation_id', conversation.id)
          .filter('metadata', 'eq', JSON.stringify(claimedMetadata))
        return Response.json({ ok: false, message: announcementResult.error.message }, { status: 500 })
      }
    }

    const notificationResult = await notifyAffectedLineupPlayers(auth.service, {
      conversationId: conversation.id,
      messageId: cardResult.messageId,
      actorUserId: auth.userId,
      scope: selected,
      notice: nextNotice,
    })
    const currentCard = await loadActionableMatchCard(auth.service, conversation.id, cardResult.messageId)
    if (currentCard.ok) {
      const currentNotice = cleanStoredLineupChangeNotice(currentCard.metadata.lineupChangeNotice)
      if (currentNotice) {
        await auth.service
          .from('internal_messages')
          .update({
            metadata: {
              ...currentCard.metadata,
              lineupChangeNotice: { ...currentNotice, notifiedCount: notificationResult.notifiedCount },
            },
          })
          .eq('id', cardResult.messageId)
          .eq('conversation_id', conversation.id)
          .filter('metadata', 'eq', JSON.stringify(currentCard.metadata))
      }
    }
    await auth.service
      .from('internal_conversations')
      .update({ updated_at: notifiedAt })
      .eq('id', conversation.id)

    return Response.json({
      ok: true,
      notifiedCount: notificationResult.notifiedCount,
      notificationIds: notificationResult.notificationIds,
      directShareNames: notificationResult.directShareNames,
      shareText: buildLineupChangeShareText(changeNotice),
      notifiedAt,
      publishedLineupChange: changeNotice.publishedLineupChange,
    })
  }

  if (action === 'respond_lineup_change') {
    const response = cleanText(body.response) as 'accepted' | 'declined'
    if (!['accepted', 'declined'].includes(response)) {
      return Response.json({ ok: false, message: 'Choose Accept or Can’t play.' }, { status: 400 })
    }
    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, cleanText(body.messageId))
    if (!cardResult.ok) return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    const changeNotice = cleanStoredLineupChangeNotice(cardResult.metadata.lineupChangeNotice)
    if (!changeNotice) {
      return Response.json({ ok: false, message: 'This lineup change is no longer available.' }, { status: 409 })
    }
    if (changeNotice.pending) {
      return Response.json({ ok: false, message: 'The captain has not sent this lineup change yet.' }, { status: 409 })
    }

    const profileById = await loadProfileMap(auth.service, [auth.userId])
    const actor = profileById.get(auth.userId)
    const actorName = actor?.linked_player_name?.trim() || actor?.message_display_name?.trim() || 'Team member'
    if (!canRespondToLineupChange(changeNotice.replacementPlayerName, [
      actor?.linked_player_name || '',
      actor?.message_display_name || '',
    ])) {
      return Response.json({ ok: false, message: 'Only the replacement player can answer this lineup change.' }, { status: 403 })
    }

    const respondedAt = new Date().toISOString()
    const nextNotice: StoredLineupChangeNotice = {
      ...changeNotice,
      response,
      respondedAt,
      responderProfileId: auth.userId,
      responderName: actorName,
      deadlineStatus: changeNotice.deadlineAt ? 'answered' : '',
    }
    const availabilityResponse: MatchResponseRow['response'] = response === 'accepted' ? 'yes' : 'no'
    const { error: responseError } = await auth.service
      .from('team_room_message_responses')
      .upsert({
        conversation_id: conversation.id,
        message_id: cardResult.messageId,
        profile_id: auth.userId,
        response: availabilityResponse,
        updated_at: respondedAt,
      }, { onConflict: 'message_id,profile_id' })
    if (responseError) return Response.json({ ok: false, message: responseError.message }, { status: 500 })

    const lineupVersion = Math.max(0, Number(cardResult.metadata.lineupVersion) || 0)
    if (lineupVersion > 0) {
      const { error: acknowledgmentError } = await auth.service
        .from('team_room_lineup_acknowledgments')
        .upsert({
          conversation_id: conversation.id,
          message_id: cardResult.messageId,
          profile_id: auth.userId,
          lineup_version: lineupVersion,
          updated_at: respondedAt,
        }, { onConflict: 'message_id,profile_id,lineup_version' })
      if (acknowledgmentError) return Response.json({ ok: false, message: acknowledgmentError.message }, { status: 500 })
    }
    await mirrorAvailabilityResponse(auth.service, {
      metadata: cardResult.metadata,
      profile: actor,
      actorName,
      response: availabilityResponse,
      scope: selected,
    })

    const republishedFinalLineup = response === 'accepted'
      && changeNotice.publishedLineupChange
      && changeNotice.publishedAnnouncementMessageId
      && changeNotice.publishedAt
      && changeNotice.publishedByUserId
      ? buildTeamRoomFinalLineupReceipt({
          lineupId: buildCaptainLockedLineupId({
            messageId: cardResult.messageId,
            lineup: normalizeLineupRows(cardResult.metadata.lineup),
          }),
          sourceMessageId: cardResult.messageId,
          announcementMessageId: changeNotice.publishedAnnouncementMessageId,
          sentAt: changeNotice.publishedAt,
          sentByUserId: changeNotice.publishedByUserId,
          sentByName: changeNotice.publishedByName,
        })
      : null
    const nextFinalLineup = changeNotice.publishedLineupChange
      ? republishedFinalLineup
      : readTeamRoomFinalLineupReceipt(cardResult.metadata.finalLineup)

    const { error: updateError } = await auth.service
      .from('internal_messages')
      .update({
        metadata: {
          ...cardResult.metadata,
          lineupChangeNotice: nextNotice,
          finalLineup: nextFinalLineup,
          arrivalCheckIns: response === 'accepted'
            ? keepTeamRoomArrivalCheckInsForLineup(
                normalizeLineupRows(cardResult.metadata.lineup),
                cardResult.metadata.arrivalCheckIns,
              )
            : readTeamRoomArrivalCheckIns(cardResult.metadata.arrivalCheckIns),
        },
        edited_at: respondedAt,
      })
      .eq('id', cardResult.messageId)
      .eq('conversation_id', conversation.id)
    if (updateError) return Response.json({ ok: false, message: updateError.message }, { status: 500 })
    const { data: replacementSchedule } = await auth.service
      .from('team_room_reminder_schedules')
      .select('id,targets')
      .eq('message_id', cardResult.messageId)
      .eq('status', 'scheduled')
      .maybeSingle()
    if (replacementSchedule && parseReminderTargets(replacementSchedule.targets).some((target) => target.needsLineupChangeResponse)) {
      await auth.service
        .from('team_room_reminder_schedules')
        .update({ status: 'cancelled', updated_at: respondedAt })
        .eq('id', replacementSchedule.id)
    }
    await auth.service
      .from('internal_conversations')
      .update({ updated_at: respondedAt })
      .eq('id', conversation.id)

    const notificationIds = await notifyManagersOfLineupChangeResponse(auth.service, {
      conversationId: conversation.id,
      messageId: cardResult.messageId,
      actorUserId: auth.userId,
      actorName,
      response,
      scope: selected,
      metadata: cardResult.metadata,
      notice: nextNotice,
    })
    return Response.json({
      ok: true,
      response,
      respondedAt,
      notificationIds,
      finalLineupPublished: Boolean(republishedFinalLineup),
    })
  }

  if (action === 'schedule_lineup_change_deadline') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can set a reply-by date.' }, { status: 403 })
    }
    const reminderAt = getLineupChangeReminderAt(cleanText(body.deadlineDate))
    if (!reminderAt || new Date(reminderAt).getTime() <= Date.now()) {
      return Response.json({ ok: false, message: 'Choose a future reply-by date.' }, { status: 400 })
    }
    const cardResult = await loadActionableMatchCard(auth.service, conversation.id, cleanText(body.messageId))
    if (!cardResult.ok) return Response.json({ ok: false, message: cardResult.message }, { status: cardResult.status })
    const matchDate = cleanText(cardResult.metadata.matchDate).slice(0, 10)
    if (matchDate && reminderAt.slice(0, 10) > matchDate) {
      return Response.json({ ok: false, message: 'Choose a reply-by date on or before match day.' }, { status: 400 })
    }
    const changeNotice = cleanStoredLineupChangeNotice(cardResult.metadata.lineupChangeNotice)
    if (!changeNotice || changeNotice.pending) {
      return Response.json({ ok: false, message: 'Send the lineup update before setting a reply-by date.' }, { status: 409 })
    }
    if (changeNotice.response) {
      return Response.json({ ok: false, message: 'The replacement has already answered.' }, { status: 409 })
    }
    const replacement = await findLineupChangeReplacementParticipant(auth.service, conversation.id, changeNotice)
    if (!replacement) {
      return Response.json({ ok: false, message: 'This replacement is not connected to Team Chat or has alerts muted.' }, { status: 409 })
    }

    const targets: TeamRoomReminderTarget[] = [{
      profileId: replacement.profile_id,
      needsResponse: false,
      needsMaybeFollowup: false,
      needsAckVersion: 0,
      needsLineupChangeResponse: true,
    }]
    const updatedAt = new Date().toISOString()
    const { error: scheduleError } = await auth.service
      .from('team_room_reminder_schedules')
      .upsert({
        conversation_id: conversation.id,
        message_id: cardResult.messageId,
        created_by_user_id: auth.userId,
        reminder_at: reminderAt,
        targets,
        status: 'scheduled',
        sent_at: null,
        notification_count: 0,
        updated_at: updatedAt,
      }, { onConflict: 'message_id' })
    if (scheduleError) return Response.json({ ok: false, message: scheduleError.message }, { status: 500 })

    const nextNotice: StoredLineupChangeNotice = {
      ...changeNotice,
      deadlineAt: reminderAt,
      deadlineStatus: 'scheduled',
      reminderSentAt: '',
    }
    const { error: messageError } = await auth.service
      .from('internal_messages')
      .update({ metadata: { ...cardResult.metadata, lineupChangeNotice: nextNotice }, edited_at: updatedAt })
      .eq('id', cardResult.messageId)
      .eq('conversation_id', conversation.id)
    if (messageError) {
      await auth.service
        .from('team_room_reminder_schedules')
        .update({ status: 'cancelled', updated_at: updatedAt })
        .eq('message_id', cardResult.messageId)
      return Response.json({ ok: false, message: messageError.message }, { status: 500 })
    }
    return Response.json({ ok: true, deadlineAt: reminderAt })
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
      messageId,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      actorName,
      response,
      metadata: message.metadata as Record<string, unknown>,
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

  if (action === 'ack_final_lineup') {
    const lineupResult = await loadCurrentFinalLineupAction(
      auth.service,
      conversation.id,
      cleanText(body.messageId),
    )
    if (!lineupResult.ok) {
      return Response.json({ ok: false, message: lineupResult.message }, { status: lineupResult.status })
    }
    const review = buildTeamRoomFinalLineupReview({
      members: syncedMembers,
      lineup: normalizeLineupRows(lineupResult.card.metadata.lineup),
      seenProfileIds: [],
      publisherUserId: lineupResult.receipt.sentByUserId,
      currentUserId: auth.userId,
    })
    if (!review.currentUserRequired) {
      return Response.json({ ok: false, message: 'Only players in this final lineup need to mark it seen.' }, { status: 403 })
    }
    const { error } = await auth.service
      .from('team_room_message_reactions')
      .upsert({
        conversation_id: conversation.id,
        message_id: lineupResult.announcement.id,
        profile_id: auth.userId,
        reaction: 'ack',
      }, { onConflict: 'message_id,profile_id,reaction' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, seen: true })
  }

  if (action === 'remind_final_lineup_unseen') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can remind lineup players.' }, { status: 403 })
    }
    const lineupResult = await loadCurrentFinalLineupAction(
      auth.service,
      conversation.id,
      cleanText(body.messageId),
    )
    if (!lineupResult.ok) {
      return Response.json({ ok: false, message: lineupResult.message }, { status: lineupResult.status })
    }
    const priorReminderAt = cleanText(lineupResult.announcement.metadata.finalLineupReviewReminderSentAt)
    if (priorReminderAt) {
      return Response.json({ ok: true, alreadySent: true, notificationIds: [], targetCount: 0, reminderSentAt: priorReminderAt })
    }
    const { data: reactionRows, error: reactionError } = await auth.service
      .from('team_room_message_reactions')
      .select('profile_id')
      .eq('message_id', lineupResult.announcement.id)
      .eq('reaction', 'ack')
    if (reactionError) return Response.json({ ok: false, message: reactionError.message }, { status: 500 })
    const review = buildTeamRoomFinalLineupReview({
      members: syncedMembers,
      lineup: normalizeLineupRows(lineupResult.card.metadata.lineup),
      seenProfileIds: ((reactionRows ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id),
      publisherUserId: lineupResult.receipt.sentByUserId,
      currentUserId: auth.userId,
    })
    if (!review.unseenProfileIds.length) {
      return Response.json({ ok: true, notificationIds: [], targetCount: 0 })
    }
    const { data: participantRows, error: participantError } = await auth.service
      .from('internal_conversation_participants')
      .select('profile_id,muted')
      .eq('conversation_id', conversation.id)
      .in('profile_id', review.unseenProfileIds)
    if (participantError) return Response.json({ ok: false, message: participantError.message }, { status: 500 })
    const recipientIds = ((participantRows ?? []) as ParticipantRow[])
      .filter((row) => row.muted !== true)
      .map((row) => row.profile_id)
    const mutedCount = review.unseenProfileIds.length - recipientIds.length
    if (!recipientIds.length) {
      return Response.json({ ok: true, notificationIds: [], targetCount: 0, mutedCount: review.unseenProfileIds.length })
    }

    const reminderSentAt = new Date().toISOString()
    const claimedMetadata = {
      ...lineupResult.announcement.metadata,
      finalLineupReviewReminderSentAt: reminderSentAt,
      finalLineupReviewReminderCount: recipientIds.length,
      finalLineupReviewReminderByUserId: auth.userId,
    }
    const claimResult = await auth.service
      .from('internal_messages')
      .update({ metadata: claimedMetadata, edited_at: reminderSentAt })
      .eq('id', lineupResult.announcement.id)
      .eq('conversation_id', conversation.id)
      .filter('metadata', 'eq', JSON.stringify(lineupResult.announcement.metadata))
      .select('id')
      .maybeSingle()
    if (claimResult.error) return Response.json({ ok: false, message: claimResult.error.message }, { status: 500 })
    if (!claimResult.data) {
      const currentResult = await loadCurrentFinalLineupAction(auth.service, conversation.id, lineupResult.announcement.id)
      const currentReminderAt = currentResult.ok
        ? cleanText(currentResult.announcement.metadata.finalLineupReviewReminderSentAt)
        : ''
      if (currentReminderAt) {
        return Response.json({ ok: true, alreadySent: true, notificationIds: [], targetCount: 0, reminderSentAt: currentReminderAt })
      }
      return Response.json({ ok: false, message: 'The final lineup changed. Refresh before sending this reminder.' }, { status: 409 })
    }
    const reminderResult = await sendFinalLineupReviewReminder(auth.service, {
      conversationId: conversation.id,
      sourceMessageId: lineupResult.receipt.sourceMessageId,
      actorUserId: auth.userId,
      recipientIds,
      teamName: selected.team_name,
      scope: selected,
      matchDate: cleanText(lineupResult.card.metadata.matchDate),
      opponent: cleanText(lineupResult.card.metadata.opponent),
    })
    if (!reminderResult.ok) {
      await auth.service
        .from('internal_messages')
        .update({ metadata: lineupResult.announcement.metadata, edited_at: new Date().toISOString() })
        .eq('id', lineupResult.announcement.id)
        .eq('conversation_id', conversation.id)
        .filter('metadata', 'eq', JSON.stringify(claimedMetadata))
      return Response.json({ ok: false, message: reminderResult.message }, { status: 500 })
    }
    return Response.json({
      ok: true,
      notificationIds: reminderResult.notificationIds,
      targetCount: recipientIds.length,
      mutedCount,
      reminderSentAt,
    })
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
      .select('id,metadata')
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
    const lineupAnnouncement = readTeamRoomLineupAnnouncement(message.metadata)
    const reactionResult = existing
      ? reaction === 'ack' && lineupAnnouncement
        ? { error: null }
        : await auth.service
          .from('team_room_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('profile_id', auth.userId)
          .eq('reaction', reaction)
      : await auth.service
          .from('team_room_message_reactions')
          .insert({ conversation_id: conversation.id, message_id: messageId, profile_id: auth.userId, reaction })
    if (reactionResult.error) return Response.json({ ok: false, message: reactionResult.error.message }, { status: 500 })
    return Response.json({ ok: true, active: Boolean(!existing || (reaction === 'ack' && lineupAnnouncement)) })
  }

  if (action === 'edit_message') {
    const messageId = cleanText(body.messageId)
    const nextBody = cleanText(body.body).slice(0, 2400)
    if (!messageId || !nextBody) return Response.json({ ok: false, message: 'Write the updated message first.' }, { status: 400 })
    const { data: message } = await auth.service
      .from('internal_messages')
      .select('id,sender_user_id,metadata,deleted_at')
      .eq('id', messageId)
      .eq('conversation_id', conversation.id)
      .maybeSingle()
    if (!message || message.deleted_at) return Response.json({ ok: false, message: 'This message is no longer available.' }, { status: 404 })
    if (readTeamRoomLineupAnnouncement(message.metadata)) {
      return Response.json({ ok: false, message: 'Published lineup updates stay in team history.' }, { status: 409 })
    }
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
    if (readTeamRoomLineupAnnouncement(message.metadata)) {
      return Response.json({ ok: false, message: 'Published lineup updates stay in team history.' }, { status: 409 })
    }
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

async function closeOpenLevelUpChallenges(
  service: SupabaseClient,
  conversationId: string,
  closedAt: string,
) {
  const { data, error } = await service
    .from('internal_messages')
    .select('id,metadata')
    .eq('conversation_id', conversationId)
    .contains('metadata', { teamLevelUpChallenge: true })
    .is('deleted_at', null)
  if (error) return { ok: false as const, message: error.message }

  const openRows = ((data ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>)
    .filter((row) => (
      isLevelUpChallengeMetadata(row.metadata)
      && !['closed', 'scheduled'].includes(cleanText(row.metadata.challengeStatus))
    ))
  const results = await Promise.all(openRows.map((row) => service
    .from('internal_messages')
    .update({ metadata: { ...row.metadata, challengeStatus: 'closed', closedAt } })
    .eq('id', row.id)
    .eq('conversation_id', conversationId)))
  const updateError = results.find((result) => result.error)?.error
  return updateError
    ? { ok: false as const, message: updateError.message }
    : { ok: true as const }
}

async function closeScheduledLevelUpChallengesForDate(
  service: SupabaseClient,
  conversationId: string,
  scheduledForDate: string,
  closedAt: string,
) {
  const { data, error } = await service
    .from('internal_messages')
    .select('id,metadata')
    .eq('conversation_id', conversationId)
    .contains('metadata', { teamLevelUpChallenge: true, challengeStatus: 'scheduled', scheduledForDate })
    .is('deleted_at', null)
  if (error) return { ok: false as const, message: error.message }
  const results = await Promise.all(((data ?? []) as Array<{
    id: string
    metadata: Record<string, unknown> | null
  }>).map((row) => service
    .from('internal_messages')
    .update({ metadata: { ...row.metadata, challengeStatus: 'closed', closedAt } })
    .eq('id', row.id)
    .eq('conversation_id', conversationId)))
  const updateError = results.find((result) => result.error)?.error
  return updateError
    ? { ok: false as const, message: updateError.message }
    : { ok: true as const }
}

async function loadScheduledLevelUpChallenge(
  service: SupabaseClient,
  conversationId: string,
  messageId: string,
) {
  if (!messageId) return { ok: false as const, status: 400, message: 'Choose a scheduled challenge.' }
  const { data, error } = await service
    .from('internal_messages')
    .select('id,metadata')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }
  const metadata = data?.metadata as Record<string, unknown> | null
  if (!data || !isLevelUpChallengeMetadata(metadata) || cleanText(metadata.challengeStatus) !== 'scheduled') {
    return { ok: false as const, status: 404, message: 'This scheduled challenge is no longer available.' }
  }
  const challenge = buildCaptainLevelUpChallenge(cleanText(metadata.challengeId))
  if (!challenge) return { ok: false as const, status: 400, message: 'This team challenge is no longer available.' }
  return { ok: true as const, messageId: data.id, metadata, challenge }
}

async function loadTeamLevelUpChallengeHistory(
  service: SupabaseClient,
  userId: string,
  selected: TeamLinkRow,
) {
  const ensured = await ensureTeamRoom(service, selected)
  if (!ensured.ok) return ensured
  const conversation = ensured.conversation
  const members = await syncTeamRoomParticipants(service, conversation.id, selected)
  if (!members.some((member) => member.id === userId)) {
    return { ok: false as const, status: 403, message: 'A captain removed this profile from Team Chat.' }
  }

  const { data: messageRows, error: messageError } = await service
    .from('internal_messages')
    .select('id,created_at,metadata')
    .eq('conversation_id', conversation.id)
    .contains('metadata', { teamLevelUpChallenge: true })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(8)
  if (messageError) return { ok: false as const, status: 500, message: messageError.message }

  const launches = ((messageRows ?? []) as Array<{
    id: string
    created_at: string | null
    metadata: Record<string, unknown> | null
  }>).flatMap((row) => {
    if (!isLevelUpChallengeMetadata(row.metadata)) return []
    const challenge = buildCaptainLevelUpChallenge(cleanText(row.metadata.challengeId))
    if (!challenge) return []
    return [{ row, challenge, launchedAt: cleanText(row.metadata.launchedAt) || cleanText(row.created_at) }]
  })
  if (!launches.length) return { ok: true as const, history: [] }

  const memberIds = members.map((member) => member.id)
  const earliestLaunchAt = launches
    .map((launch) => launch.launchedAt)
    .filter(Boolean)
    .sort()[0] || new Date(0).toISOString()
  const messageIds = launches.map((launch) => launch.row.id)
  const [sessionResult, reactionResult] = await Promise.all([
    memberIds.length
      ? service
          .from('level_up_sessions')
          .select('player_user_id,focus_id,drill_title,completed_at')
          .in('player_user_id', memberIds)
          .gte('completed_at', earliestLaunchAt)
      : Promise.resolve({ data: [], error: null }),
    service
      .from('team_room_message_reactions')
      .select('message_id,profile_id,reaction')
      .in('message_id', messageIds)
      .eq('reaction', 'ack'),
  ])
  if (sessionResult.error) return { ok: false as const, status: 500, message: sessionResult.error.message }
  if (reactionResult.error) return { ok: false as const, status: 500, message: reactionResult.error.message }

  const memberIdSet = new Set(memberIds)
  const sessions = (sessionResult.data ?? []) as Array<{
    player_user_id: string
    focus_id: string
    drill_title: string
    completed_at: string | null
  }>
  const reactions = (reactionResult.data ?? []) as ReactionRow[]
  const activeMessageId = selectActiveCaptainLevelUpChallenge(launches.map(({ row, launchedAt }) => ({
    id: row.id,
    createdAt: launchedAt,
    status: cleanText(row.metadata?.challengeStatus),
  })))
  return {
    ok: true as const,
    history: launches.map(({ row, challenge, launchedAt }) => {
      const closedAt = cleanText(row.metadata?.closedAt)
      const storedStatus = cleanText(row.metadata?.challengeStatus)
      const isScheduled = storedStatus === 'scheduled'
      const scheduledForDate = cleanText(row.metadata?.scheduledForDate)
      const isCancelledSchedule = storedStatus === 'closed'
        && Boolean(scheduledForDate)
        && !cleanText(row.metadata?.launchedAt)
      const automaticCompletedIds = isScheduled || isCancelledSchedule
        ? []
        : getCaptainLevelUpCompletedPlayerIdsForRun(
            challenge,
            sessions.map((session) => ({
              playerUserId: session.player_user_id,
              focusId: session.focus_id,
              drillTitle: session.drill_title,
              completedAt: cleanText(session.completed_at),
            })),
            launchedAt,
            closedAt,
          )
      const completedIds = new Set(isScheduled || isCancelledSchedule ? [] : [
        ...automaticCompletedIds,
        ...reactions
          .filter((reaction) => reaction.message_id === row.id && memberIdSet.has(reaction.profile_id))
          .map((reaction) => reaction.profile_id),
      ])
      return {
        messageId: row.id,
        challengeId: challenge.id,
        title: challenge.title,
        focus: challenge.focus,
        status: isScheduled
          ? 'scheduled'
          : isCancelledSchedule ? 'cancelled' : row.id === activeMessageId ? 'active' : 'closed',
        scheduledForDate,
        launchedAt,
        closedAt,
        completedCount: completedIds.size,
        connectedCount: members.length,
      }
    }),
  }
}

async function loadTeamLevelUpChallengeProgress(
  service: SupabaseClient,
  userId: string,
  selected: TeamLinkRow,
  challenge: CaptainLevelUpChallenge,
) {
  const ensured = await ensureTeamRoom(service, selected)
  if (!ensured.ok) return ensured
  const conversation = ensured.conversation
  const members = await syncTeamRoomParticipants(service, conversation.id, selected)
  if (!members.some((member) => member.id === userId)) {
    return { ok: false as const, status: 403, message: 'A captain removed this profile from Team Chat.' }
  }

  const { data: launchRows, error: launchError } = await service
    .from('internal_messages')
    .select('id,created_at,metadata')
    .eq('conversation_id', conversation.id)
    .contains('metadata', { teamLevelUpChallenge: true, challengeId: challenge.id })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (launchError) return { ok: false as const, status: 500, message: launchError.message }

  const typedLaunchRows = (launchRows ?? []) as Array<{
    id?: string | null
    created_at?: string | null
    metadata?: Record<string, unknown> | null
  }>
  const activeLaunchId = selectActiveCaptainLevelUpChallenge(typedLaunchRows.map((row) => ({
    id: cleanText(row.id),
    createdAt: cleanText(row.created_at),
    status: cleanText(row.metadata?.challengeStatus),
  })))
  const launch = typedLaunchRows.find((row) => cleanText(row.id) === activeLaunchId)
  const launchedAt = cleanText(launch?.created_at)
  const messageId = cleanText(launch?.id)
  if (!messageId || !launchedAt) {
    return {
      ok: true as const,
      progress: { launched: false, completedCount: 0, connectedCount: members.length, launchedAt: '', messageId: '' },
    }
  }

  const completionResult = await loadTeamLevelUpChallengeCompletion(
    service,
    challenge,
    members.map((member) => member.id),
    messageId,
    launchedAt,
  )
  if (!completionResult.ok) return completionResult

  return {
    ok: true as const,
    progress: {
      launched: true,
      completedCount: completionResult.completedIds.size,
      connectedCount: members.length,
      launchedAt,
      messageId,
    },
  }
}

async function loadTeamLevelUpChallengeCompletion(
  service: SupabaseClient,
  challenge: CaptainLevelUpChallenge,
  memberIds: string[],
  messageId: string,
  launchedAt: string,
  knownReactions?: ReactionRow[],
) {
  const [sessionResult, reactionResult] = await Promise.all([
    memberIds.length
      ? service
          .from('level_up_sessions')
          .select('player_user_id,focus_id,drill_title')
          .in('player_user_id', memberIds)
          .gte('completed_at', launchedAt)
      : Promise.resolve({ data: [], error: null }),
    knownReactions
      ? Promise.resolve({ data: knownReactions, error: null })
      : service
          .from('team_room_message_reactions')
          .select('message_id,profile_id,reaction')
          .eq('message_id', messageId)
          .eq('reaction', 'ack'),
  ])
  if (sessionResult.error) return { ok: false as const, status: 500, message: sessionResult.error.message }
  if (reactionResult.error) return { ok: false as const, status: 500, message: reactionResult.error.message }

  const completedCardIdsByPlayer = getCaptainLevelUpCompletedCardIdsByPlayer(
    challenge,
    ((sessionResult.data ?? []) as Array<{ player_user_id: string; focus_id: string; drill_title: string }>).map((row) => ({
      playerUserId: row.player_user_id,
      focusId: row.focus_id,
      drillTitle: row.drill_title,
    })),
  )
  const automaticCompletedIds = Array.from(completedCardIdsByPlayer.entries())
    .filter(([, cardIds]) => challenge.cardIds.length > 0 && cardIds.length === challenge.cardIds.length)
    .map(([playerUserId]) => playerUserId)
  const memberIdSet = new Set(memberIds)
  return {
    ok: true as const,
    completedCardIdsByPlayer,
    completedIds: new Set([
      ...automaticCompletedIds,
      ...((reactionResult.data ?? []) as ReactionRow[])
        .map((row) => row.profile_id)
        .filter((profileId) => memberIdSet.has(profileId)),
    ]),
  }
}

async function loadActionableLevelUpChallenge(
  service: SupabaseClient,
  conversationId: string,
  messageId: string,
  members: Array<{ id: string }>,
) {
  if (!messageId) return { ok: false as const, status: 400, message: 'Choose a team challenge.' }
  const { data, error } = await service
    .from('internal_messages')
    .select('id,metadata,created_at')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }
  const metadata = data?.metadata as Record<string, unknown> | null
  if (!data || !isLevelUpChallengeMetadata(metadata) || ['closed', 'scheduled'].includes(cleanText(metadata?.challengeStatus))) {
    return { ok: false as const, status: 404, message: 'This team challenge is no longer active.' }
  }
  const challenge = buildCaptainLevelUpChallenge(cleanText(metadata.challengeId))
  if (!challenge) return { ok: false as const, status: 400, message: 'This team challenge is no longer available.' }
  const completionResult = await loadTeamLevelUpChallengeCompletion(
    service,
    challenge,
    members.map((member) => member.id),
    data.id,
    cleanText(metadata.launchedAt) || cleanText(data.created_at),
  )
  if (!completionResult.ok) return completionResult
  return { ok: true as const, message: data, challenge, completedIds: completionResult.completedIds }
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
  const [responseByMessageId, ackByMessageId, reminderByMessageId, reactionByMessageId, attachmentUrlByMessageId, availabilityByRequestId, management] = await Promise.all([
    loadMatchResponses(service, messageIds),
    loadLineupAcknowledgments(service, messageIds),
    loadReminderSchedules(service, messageIds),
    loadMessageReactions(service, messageIds),
    loadAttachmentUrls(service, typedMessageRows),
    loadAvailabilityRequestSummaries(service, typedMessageRows),
    canManageTeamRoom(teamRoles(selected))
      ? loadTeamRoomManagement(service, userId, conversation.id, selected, members)
      : Promise.resolve({ rosterMembers: [], removedMembers: [], activeInviteCount: 0 }),
  ])
  const cardCandidates = typedMessageRows.flatMap((row) => {
    if (row.deleted_at || !isMatchCardMetadata(row.metadata)) return []
    return [{ id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) }]
  })
  const matchProgress = await resolveTeamRoomMatchProgress(
    service,
    selected,
    typedMessageRows,
    cardCandidates,
  )
  const planningCardId = matchProgress.planningCardId
  const activeCardId = matchProgress.activeCardId
  const nextScheduledMatch = planningCardId
    ? null
    : await loadCaptainResumeNextMatchForScope(service, {
        team: selected.team_name,
        league: selected.league_name,
        flight: selected.flight,
      }, todayDateKey())
  const activeLevelUpChallengeId = selectActiveCaptainLevelUpChallenge(typedMessageRows.flatMap((row) => {
    if (row.deleted_at || !isLevelUpChallengeMetadata(row.metadata)) return []
    return [{
      id: row.id,
      createdAt: row.created_at || '',
      status: cleanText(row.metadata.challengeStatus),
    }]
  }))
  const activeLevelUpRow = typedMessageRows.find((row) => row.id === activeLevelUpChallengeId)
  const activeLevelUpChallenge = activeLevelUpRow
    ? buildCaptainLevelUpChallenge(cleanText(activeLevelUpRow.metadata?.challengeId))
    : null
  const activeLevelUpCompletion = activeLevelUpRow && activeLevelUpChallenge
    ? await loadTeamLevelUpChallengeCompletion(
        service,
        activeLevelUpChallenge,
        members.map((member) => member.id),
        activeLevelUpRow.id,
        cleanText(activeLevelUpRow.metadata?.launchedAt) || cleanText(activeLevelUpRow.created_at),
        reactionByMessageId.get(activeLevelUpRow.id) || [],
      )
    : {
        ok: true as const,
        completedIds: new Set<string>(),
        completedCardIdsByPlayer: new Map<string, string[]>(),
      }
  if (!activeLevelUpCompletion.ok) return activeLevelUpCompletion
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
        ? teamRoomCardState(
            { id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) },
            activeCardId,
            undefined,
            matchProgress.completedCardIds,
          )
        : null,
      reactionByMessageId.get(row.id) || [],
      attachmentUrlByMessageId.get(row.id) || '',
      isMatchCardMetadata(row.metadata)
        ? availabilityByRequestId.get(cleanText(row.metadata.availabilityRequestId)) || null
        : null,
      row.id === activeLevelUpChallengeId ? Array.from(activeLevelUpCompletion.completedIds) : [],
      row.id === activeLevelUpChallengeId
        ? activeLevelUpCompletion.completedCardIdsByPlayer.get(userId) || []
        : [],
      members.length,
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
  const activeCardRow = rowById.get(activeCardId)
  const finalResult = matchProgress.finalResult
  const currentFinalLineup = readTeamRoomFinalLineupReceipt(activeCardRow?.metadata?.finalLineup)
  const currentFinalLineupAnnouncement = currentFinalLineup
    ? rowById.get(currentFinalLineup.announcementMessageId)
    : null
  const finalLineupReview = currentFinalLineup
    ? buildTeamRoomFinalLineupReview({
        members,
        lineup: normalizeLineupRows(activeCardRow?.metadata?.lineup),
        seenProfileIds: (reactionByMessageId.get(currentFinalLineup.announcementMessageId) || [])
          .filter((reaction) => reaction.reaction === 'ack')
          .map((reaction) => reaction.profile_id),
        publisherUserId: currentFinalLineup.sentByUserId,
        currentUserId: userId,
      })
    : null
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
      nextScheduledMatch: nextScheduledMatch ? {
        id: nextScheduledMatch.matchId,
        source: nextScheduledMatch.source,
        matchDate: nextScheduledMatch.date,
        matchTime: nextScheduledMatch.time,
        opponent: nextScheduledMatch.opponent,
        facility: nextScheduledMatch.facility,
      } : null,
      finalResultCardId: matchProgress.finalResultCardId,
      activeLevelUpChallengeId,
      finalResult,
      finalLineupReview: currentFinalLineup && finalLineupReview ? {
        announcementMessageId: currentFinalLineup.announcementMessageId,
        sourceMessageId: currentFinalLineup.sourceMessageId,
        requiredCount: finalLineupReview.requiredCount,
        seenCount: finalLineupReview.seenCount,
        unseenNames: canManageTeamRoom(teamRoles(selected)) ? finalLineupReview.unseenNames : [],
        currentUserRequired: finalLineupReview.currentUserRequired,
        currentUserSeen: finalLineupReview.currentUserSeen,
        reminderSentAt: cleanText(currentFinalLineupAnnouncement?.metadata?.finalLineupReviewReminderSentAt),
      } : null,
      actionQueue: buildTeamRoomActionQueue(members, messages.find((message) => message.id === planningCardId) || null),
      messages,
      href: buildTeamRoomHref({
        teamName: selected.team_name,
        leagueName: selected.league_name,
        flight: selected.flight,
      }),
    },
  }
}

async function resolveTeamRoomMatchProgress(
  service: SupabaseClient,
  scope: TeamLinkRow,
  rows: MessageRow[],
  cards: Array<{ id: string; createdAt: string; matchDate: string }>,
) {
  const rowById = new Map(rows.map((row) => [row.id, row]))
  const completedCardIds = new Set<string>()
  let finalResult: Awaited<ReturnType<typeof loadTeamRoomFinalResult>> = null
  let finalResultCardId = ''
  let planningCardId = selectActiveTeamRoomCard(cards)
  const maxChecks = Math.min(cards.length, 6)

  for (let check = 0; planningCardId && check < maxChecks; check += 1) {
    const row = rowById.get(planningCardId)
    if (!row || !isMatchCardMetadata(row.metadata)) break
    const result = await loadTeamRoomFinalResult(service, scope, row.metadata)
    if (!result) break
    completedCardIds.add(planningCardId)
    finalResult = result
    finalResultCardId = planningCardId
    planningCardId = selectActiveTeamRoomCard(cards, undefined, completedCardIds)
  }

  if (planningCardId) {
    return {
      planningCardId,
      activeCardId: planningCardId,
      completedCardIds,
      finalResult,
      finalResultCardId,
    }
  }

  const fallbackCardId = finalResultCardId || selectLatestPastTeamRoomCard(cards)
  if (!finalResult && fallbackCardId) {
    const row = rowById.get(fallbackCardId)
    if (row && isMatchCardMetadata(row.metadata)) {
      finalResult = await loadTeamRoomFinalResult(service, scope, row.metadata)
      if (finalResult) {
        finalResultCardId = fallbackCardId
        completedCardIds.add(fallbackCardId)
      }
    }
  }
  return {
    planningCardId: '',
    activeCardId: fallbackCardId,
    completedCardIds,
    finalResult,
    finalResultCardId,
  }
}

async function loadTeamRoomFinalResult(
  service: SupabaseClient,
  scope: TeamLinkRow,
  metadata: Record<string, unknown>,
) {
  const matchDate = cleanText(metadata.matchDate).slice(0, 10)
  if (!matchDate) return null
  const { data, error } = await service
    .from('matches')
    .select('id,external_match_id,home_team,away_team,match_date,league_name,flight,winner_side,score,status,line_number')
    .eq('match_date', matchDate)
    .eq('status', 'completed')
    .is('line_number', null)
    .limit(100)
  if (error) return null
  const completedMatches = (data ?? []) as TeamRoomCompletedMatch[]
  const match = selectTeamRoomCompletedMatch(completedMatches, {
    matchId: cleanText(metadata.matchId),
    teamName: scope.team_name,
    leagueName: scope.league_name,
    flight: scope.flight,
    matchDate,
    opponent: cleanText(metadata.opponent),
    externalMatchId: cleanText(metadata.externalMatchId),
  })
  const result = match ? buildTeamRoomFinalResult(match, scope.team_name) : null
  const teamSide = match ? getTeamRoomMatchSide(match, scope.team_name) : null
  const parentExternalMatchId = cleanText(match?.external_match_id)
  if (!result || !teamSide || !parentExternalMatchId) return result

  const { data: lineMatchData, error: lineMatchError } = await service
    .from('matches')
    .select('id,external_match_id,line_number,match_type,winner_side,score,status')
    .eq('match_date', matchDate)
    .eq('status', 'completed')
    .not('line_number', 'is', null)
    .like('external_match_id', `${parentExternalMatchId}::line:%`)
    .limit(25)
  if (lineMatchError) return result
  const lineMatches = (lineMatchData ?? []) as TeamRoomCompletedLineMatch[]
  const lineMatchIds = lineMatches.map((line) => line.id)
  if (!lineMatchIds.length) return result

  const { data: matchPlayerData, error: matchPlayerError } = await service
    .from('match_players')
    .select('match_id,player_id,side,seat')
    .in('match_id', lineMatchIds)
  if (matchPlayerError) return result
  const matchPlayers = (matchPlayerData ?? []) as TeamRoomLinePlayer[]
  const playerIds = Array.from(new Set(matchPlayers.map((player) => player.player_id).filter(Boolean)))
  let players: TeamRoomPlayerName[] = []
  if (playerIds.length) {
    const { data: playerData, error: playerError } = await service
      .from('players')
      .select('id,name')
      .in('id', playerIds)
    if (playerError) return result
    players = (playerData ?? []) as TeamRoomPlayerName[]
  }

  const lines = buildTeamRoomFinalResultLines({
    matches: lineMatches,
    matchPlayers,
    players,
    teamSide,
    lineupLabels: normalizeLineupRows(metadata.lineup).map((line) => line.label),
  })
  return {
    ...result,
    lines,
    unresolvedPlayerCount: lines.reduce((total, line) => (
      total + line.teamMissingPlayerCount + line.opponentMissingPlayerCount
    ), 0),
  }
}

type LevelUpChallengeMessageRow = Pick<MessageRow, 'id' | 'metadata' | 'created_at' | 'deleted_at'>

async function loadBestActiveTeamChallenge(
  service: SupabaseClient,
  userId: string,
  links: TeamLinkRow[],
) {
  const uniqueLinks = Array.from(new Map(links.map((link) => [
    buildTeamRoomScopeId({
      teamName: link.team_name,
      leagueName: link.league_name,
      flight: link.flight,
    }),
    link,
  ])).values())
  const results = await Promise.all(uniqueLinks.map((link) => (
    loadExistingActiveTeamChallenge(service, userId, link)
  )))
  const failed = results.find((result) => !result.ok && result.status !== 403)
  if (failed && !failed.ok) return failed
  const challenges = results.flatMap((result) => (
    result.ok && result.activeChallenge ? [result.activeChallenge] : []
  ))
  const activeChallenges = sortCaptainLevelUpChallengeResumes(challenges)
  return {
    ok: true as const,
    activeChallenge: activeChallenges[0] ?? null,
    activeChallenges,
  }
}

async function loadExistingActiveTeamChallenge(
  service: SupabaseClient,
  userId: string,
  selected: TeamLinkRow,
) {
  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  const { data: conversation, error: conversationError } = await service
    .from('internal_conversations')
    .select('id')
    .eq('related_entity_type', 'team_room')
    .eq('related_entity_id', scopeId)
    .maybeSingle()
  if (conversationError) return { ok: false as const, status: 500, message: conversationError.message }
  if (!conversation?.id) return { ok: true as const, activeChallenge: null }

  const members = await syncTeamRoomParticipants(service, conversation.id, selected)
  if (!members.some((member) => member.id === userId)) {
    return { ok: false as const, status: 403, message: 'A captain removed this profile from Team Chat.' }
  }
  const { data: challengeRows, error: challengeError } = await service
    .from('internal_messages')
    .select('id,metadata,created_at,deleted_at')
    .eq('conversation_id', conversation.id)
    .contains('metadata', { teamLevelUpChallenge: true })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (challengeError) return { ok: false as const, status: 500, message: challengeError.message }

  return buildActiveTeamChallengeSummary(
    service,
    userId,
    selected,
    members,
    (challengeRows ?? []) as LevelUpChallengeMessageRow[],
  )
}

async function buildActiveTeamChallengeSummary(
  service: SupabaseClient,
  userId: string,
  selected: TeamLinkRow,
  members: Array<{ id: string }>,
  messageRows: LevelUpChallengeMessageRow[],
) {
  const activeLevelUpChallengeId = selectActiveCaptainLevelUpChallenge(messageRows.flatMap((row) => {
    if (row.deleted_at || !isLevelUpChallengeMetadata(row.metadata)) return []
    return [{
      id: row.id,
      createdAt: cleanText(row.metadata.launchedAt) || cleanText(row.created_at),
      status: cleanText(row.metadata.challengeStatus),
    }]
  }))
  const activeLevelUpRow = messageRows.find((row) => row.id === activeLevelUpChallengeId)
  const activeLevelUpChallenge = activeLevelUpRow
    ? buildCaptainLevelUpChallenge(cleanText(activeLevelUpRow.metadata?.challengeId))
    : null
  if (!activeLevelUpRow || !activeLevelUpChallenge) {
    return { ok: true as const, activeChallenge: null }
  }

  const launchedAt = cleanText(activeLevelUpRow.metadata?.launchedAt) || cleanText(activeLevelUpRow.created_at)
  const completionResult = await loadTeamLevelUpChallengeCompletion(
    service,
    activeLevelUpChallenge,
    members.map((member) => member.id),
    activeLevelUpRow.id,
    launchedAt,
  )
  if (!completionResult.ok) return completionResult

  const completed = completionResult.completedIds.has(userId)
  const completedCardIds = completed
    ? activeLevelUpChallenge.cardIds
    : completionResult.completedCardIdsByPlayer.get(userId) || []
  const nextCardId = activeLevelUpChallenge.cardIds.find((cardId) => !completedCardIds.includes(cardId))
    || activeLevelUpChallenge.cardIds[0]
    || ''
  const teamRoomHref = buildTeamRoomHref({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
    messageId: activeLevelUpRow.id,
  })
  return {
    ok: true as const,
    activeChallenge: {
      messageId: activeLevelUpRow.id,
      id: activeLevelUpChallenge.id,
      title: activeLevelUpChallenge.title,
      focus: activeLevelUpChallenge.focus,
      teamName: selected.team_name,
      leagueName: selected.league_name,
      flight: selected.flight,
      cardIds: activeLevelUpChallenge.cardIds,
      completedCardIds,
      completed,
      completedCount: completionResult.completedIds.size,
      connectedCount: members.length,
      launchedAt,
      resumeHref: nextCardId ? buildCaptainLevelUpCardHref(nextCardId) : teamRoomHref,
      teamRoomHref,
    } satisfies TeamRoomActiveChallengeSummary,
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
  const cardCandidates = messageRows.flatMap((row) => {
    if (row.deleted_at || !isMatchCardMetadata(row.metadata)) return []
    return [{ id: row.id, createdAt: row.created_at || '', matchDate: cleanText(row.metadata.matchDate) }]
  })
  const matchProgress = await resolveTeamRoomMatchProgress(service, selected, messageRows, cardCandidates)
  const activeCardId = matchProgress.planningCardId
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
    ? toMessage(
        latestCard,
        profileById,
        userId,
        responses,
        acknowledgments,
        reminders,
        'active',
        [],
        '',
        (await loadAvailabilityRequestSummaries(service, [latestCard]))
          .get(cleanText(latestCard.metadata?.availabilityRequestId)) || null,
      )
    : null
  const actionQueue = buildTeamRoomActionQueue(members, message)
  const pendingCount = canManageTeamRoom(teamRoles(selected)) ? actionQueue.waitingCount : 0
  const availabilitySummary = message?.card?.availabilitySummary
  const responseNames = (status: MatchResponseRow['response']) => Array.from(new Set(
    responses
      .filter((response) => response.response === status)
      .flatMap((response) => {
        const profile = profileById.get(response.profile_id)
        return [profile?.message_display_name || '', profile?.linked_player_name || '']
      })
      .map(cleanText)
      .filter(Boolean),
  ))
  const responseIds = new Set(responses.map((response) => response.profile_id))
  const waitingNames = members
    .filter((member) => !responseIds.has(member.id))
    .flatMap((member) => [member.name, member.playerName || ''])
    .map(cleanText)
    .filter(Boolean)
  const activeLineup = normalizeLineupRows(message?.card?.lineup)
  const finalLineup = readTeamRoomFinalLineupReceipt(latestCard?.metadata?.finalLineup)
  const activeLineupChange = cleanStoredLineupChangeNotice(latestCard?.metadata?.lineupChangeNotice)
  const courtReadiness = buildTeamRoomCourtReadiness({
    lineup: activeLineup,
    replies: [
      { status: 'yes', names: availabilitySummary?.yesNames ?? responseNames('yes') },
      { status: 'no', names: availabilitySummary?.noNames ?? responseNames('no') },
      { status: 'maybe', names: availabilitySummary?.maybeNames ?? responseNames('maybe') },
      { status: 'waiting', names: availabilitySummary?.waitingNames ?? waitingNames },
    ],
    lineupChange: activeLineupChange,
  })

  const activeChallengeResult = await buildActiveTeamChallengeSummary(
    service,
    userId,
    selected,
    members,
    messageRows,
  )
  if (!activeChallengeResult.ok) return activeChallengeResult

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
      courtReadiness: {
        messageId: message?.id || '',
        confirmedCount: courtReadiness.filter((court) => court.status === 'confirmed').length,
        totalCount: courtReadiness.length,
        lineup: activeLineup,
        finalLineup: finalLineup ? {
          ...finalLineup,
          sentByName: finalLineup.sentByName
            || profileById.get(finalLineup.sentByUserId)?.message_display_name?.trim()
            || profileById.get(finalLineup.sentByUserId)?.linked_player_name?.trim()
            || 'Team captain',
        } : null,
        lineupChange: activeLineupChange ? {
          courtLabel: activeLineupChange.courtLabel,
          outgoingPlayerName: activeLineupChange.outgoingPlayerName,
          replacementPlayerName: activeLineupChange.replacementPlayerName,
          affectedNames: activeLineupChange.affectedNames,
          afterPlayers: activeLineupChange.afterPlayers,
          pending: activeLineupChange.pending,
          response: activeLineupChange.response,
          respondedAt: activeLineupChange.respondedAt,
        } : null,
        courts: courtReadiness.flatMap((court, index) => court.status === 'confirmed' ? [] : [{
          label: court.label || `Court ${index + 1}`,
          status: court.status,
        }]),
      },
      activeChallenge: activeChallengeResult.activeChallenge,
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

async function notifyAffectedLineupPlayers(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  actorUserId: string
  scope: TeamLinkRow
  notice: StoredLineupChangeNotice
}) {
  const { data } = await service
    .from('internal_conversation_participants')
    .select('profile_id,muted')
    .eq('conversation_id', input.conversationId)
  const participants = (data ?? []) as ParticipantRow[]
  const profileById = await loadProfileMap(service, participants.map((row) => row.profile_id))
  const affectedByKey = new Map(input.notice.affectedNames.map((name) => [normalizePersonKey(name), name] as const))
  const handledKeys = new Set<string>()
  const recipients = participants.flatMap((participant) => {
    const profile = profileById.get(participant.profile_id)
    const matchingKey = [profile?.linked_player_name, profile?.message_display_name]
      .map(normalizePersonKey)
      .find((key) => affectedByKey.has(key))
    if (!matchingKey) return []
    if (participant.profile_id === input.actorUserId) {
      handledKeys.add(matchingKey)
      return []
    }
    if (participant.muted === true) return []
    handledKeys.add(matchingKey)
    return [participant]
  })

  const hrefBase = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
  })
  const hrefUrl = new URL(hrefBase, 'https://tenaceiq.local')
  hrefUrl.searchParams.set('message', input.messageId)
  hrefUrl.searchParams.set('court', input.notice.courtLabel)
  hrefUrl.hash = `match-card-${encodeURIComponent(input.messageId)}`
  const href = `${hrefUrl.pathname}${hrefUrl.search}${hrefUrl.hash}`
  const title = `${input.scope.team_name} lineup changed`
  const notificationBody = `${input.notice.courtLabel}: ${input.notice.replacementPlayerName} is in for ${input.notice.outgoingPlayerName}.`
  const { data: notifications } = recipients.length
    ? await service.from('internal_notifications').insert(recipients.map((row) => ({
        recipient_profile_id: row.profile_id,
        actor_user_id: input.actorUserId,
        notification_type: 'message',
        title,
        body: notificationBody,
        href,
        conversation_id: input.conversationId,
      }))).select('id')
    : { data: [] as Array<{ id?: string | null }> }

  if (recipients.length) {
    await sendTeamRoomPush(service, recipients.map((row) => row.profile_id), {
      title,
      body: notificationBody,
      href,
      tag: `team-room-lineup-${input.messageId}`,
    })
  }

  return {
    notifiedCount: recipients.length,
    notificationIds: ((notifications ?? []) as Array<{ id?: string | null }>).map((row) => cleanText(row.id)).filter(Boolean),
    directShareNames: input.notice.affectedNames.filter((name) => !handledKeys.has(normalizePersonKey(name))),
  }
}

async function notifyManagersOfArrivalStatus(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  actorUserId: string
  actorName: string
  courtLabel: string
  scope: TeamLinkRow
  managerIds: string[]
}) {
  const recipientIds = [...new Set(input.managerIds)].filter(Boolean)
  if (!recipientIds.length) return
  const hrefBase = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
  })
  const hrefUrl = new URL(hrefBase, 'https://tenaceiq.local')
  hrefUrl.searchParams.set('message', input.messageId)
  hrefUrl.searchParams.set('court', input.courtLabel)
  hrefUrl.hash = `match-plan-${encodeURIComponent(input.messageId)}`
  const href = `${hrefUrl.pathname}${hrefUrl.search}${hrefUrl.hash}`
  const title = `${input.scope.team_name} arrival update`
  const body = `${input.actorName} is ${teamRoomArrivalStatusLabel('running_late').toLowerCase()} for ${input.courtLabel}.`
  await service.from('internal_notifications').insert(recipientIds.map((recipientId) => ({
    recipient_profile_id: recipientId,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body,
    href,
    conversation_id: input.conversationId,
  })))
  await sendTeamRoomPush(service, recipientIds, {
    title,
    body,
    href,
    tag: `team-room-arrival-${input.messageId}`,
  })
}

async function findLineupChangeReplacementParticipant(
  service: SupabaseClient,
  conversationId: string,
  notice: StoredLineupChangeNotice,
) {
  const { data } = await service
    .from('internal_conversation_participants')
    .select('profile_id,muted')
    .eq('conversation_id', conversationId)
  const participants = ((data ?? []) as ParticipantRow[]).filter((participant) => participant.muted !== true)
  const profileById = await loadProfileMap(service, participants.map((participant) => participant.profile_id))
  return participants.find((participant) => {
    const profile = profileById.get(participant.profile_id)
    return canRespondToLineupChange(notice.replacementPlayerName, [
      profile?.linked_player_name || '',
      profile?.message_display_name || '',
    ])
  }) || null
}

async function notifyManagersOfLineupChangeResponse(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  actorUserId: string
  actorName: string
  response: 'accepted' | 'declined'
  scope: TeamLinkRow
  metadata: Record<string, unknown>
  notice: StoredLineupChangeNotice
}) {
  const { data } = await service
    .from('internal_conversation_participants')
    .select('profile_id,participant_role,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((data ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== input.actorUserId && row.participant_role === 'coordinator' && row.muted !== true)
  if (!recipients.length) return []

  const baseNotification = buildCaptainReplyNotification({
    playerName: input.actorName,
    status: input.response === 'accepted' ? 'available' : 'unavailable',
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
    matchDate: cleanText(input.metadata.matchDate).slice(0, 10),
    opponentTeam: cleanText(input.metadata.opponent),
    teamRoomMessageId: input.messageId,
    availabilityRequestId: cleanText(input.metadata.availabilityRequestId),
    courtLabel: input.notice.courtLabel,
  })
  const title = input.response === 'accepted'
    ? `${input.actorName} accepted ${input.notice.courtLabel}`
    : `${input.actorName} can’t play ${input.notice.courtLabel}`
  const body = input.response === 'accepted'
    ? `${input.notice.replacementPlayerName} confirmed the replacement.`
    : 'Open the court and choose another player.'
  const { data: notifications } = await service
    .from('internal_notifications')
    .insert(recipients.map((row) => ({
      recipient_profile_id: row.profile_id,
      actor_user_id: input.actorUserId,
      notification_type: 'message',
      title,
      body,
      href: baseNotification.href,
      conversation_id: input.conversationId,
    })))
    .select('id')
  await sendTeamRoomPush(service, recipients.map((row) => row.profile_id), {
    title,
    body,
    href: baseNotification.href,
    tag: `team-room-lineup-response-${input.messageId}`,
  })
  return ((notifications ?? []) as Array<{ id?: string | null }>)
    .map((row) => cleanText(row.id))
    .filter(Boolean)
}

async function notifyTeamRoomManagers(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  actorName: string
  response: MatchResponseRow['response']
  metadata: Record<string, unknown>
}) {
  const { data: participants } = await service
    .from('internal_conversation_participants')
    .select('profile_id,participant_role,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((participants ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== input.actorUserId && row.participant_role === 'coordinator' && row.muted !== true)
  if (!recipients.length) return

  const matchDate = cleanText(input.metadata.matchDate).slice(0, 10)
  const opponent = cleanText(input.metadata.opponent)
  const courtLabel = findCaptainReplyCourt(input.metadata.lineup, { playerName: input.actorName })
  const notification = buildCaptainReplyNotification({
    playerName: input.actorName,
    status: input.response,
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
    matchDate,
    opponentTeam: opponent,
    teamRoomMessageId: input.messageId,
    availabilityRequestId: cleanText(input.metadata.availabilityRequestId),
    courtLabel,
  })
  await service.from('internal_notifications').insert(recipients.map((row) => ({
    recipient_profile_id: row.profile_id,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    ...notification,
    conversation_id: input.conversationId,
  })))
  await sendTeamRoomPush(service, recipients.map((row) => row.profile_id), {
    title: notification.title,
    body: notification.body,
    href: notification.href,
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
  availabilitySummary: TeamRoomAvailabilitySummary | null = null,
  levelUpCompletedProfileIds: string[] = [],
  levelUpCompletedCardIds: string[] = [],
  connectedCount = 0,
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
    availabilitySummary,
    finalLineup: readTeamRoomFinalLineupReceipt(row.metadata.finalLineup),
    arrivalCheckIns: readTeamRoomArrivalCheckIns(row.metadata.arrivalCheckIns),
    matchCompletedAt: cleanText(row.metadata.matchCompletedAt),
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
  const levelUpChallenge = !row.deleted_at && isLevelUpChallengeMetadata(row.metadata)
    ? buildTeamRoomLevelUpChallengePayload(
        row.metadata,
        currentUserId,
        reactions,
        levelUpCompletedProfileIds,
        levelUpCompletedCardIds,
        connectedCount,
      )
    : null
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
    levelUpChallenge,
    lineupAnnouncement: !row.deleted_at ? readTeamRoomLineupAnnouncement(row.metadata) : null,
    response: responses.find((item) => item.profile_id === currentUserId)?.response || null,
    responseSummary: availabilitySummary
      ? {
          yes: availabilitySummary.yes,
          maybe: availabilitySummary.maybe,
          no: availabilitySummary.no,
          total: availabilitySummary.yes + availabilitySummary.maybe + availabilitySummary.no,
        }
      : { yes: yesCount, maybe: maybeCount, no: noCount, total: responses.length },
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

function buildTeamRoomLevelUpChallengePayload(
  metadata: Record<string, unknown>,
  currentUserId: string,
  reactions: ReactionRow[],
  completedProfileIds: string[] = [],
  completedCardIds: string[] = [],
  connectedCount = 0,
): TeamRoomLevelUpChallengePayload | null {
  const challenge = buildCaptainLevelUpChallenge(cleanText(metadata.challengeId))
  if (!challenge) return null
  const acknowledgedProfileIds = reactions
    .filter((reaction) => reaction.reaction === 'ack')
    .map((reaction) => reaction.profile_id)
  const aggregateCompletedIds = completedProfileIds.length ? completedProfileIds : acknowledgedProfileIds
  const completed = aggregateCompletedIds.includes(currentUserId)
  const currentUserCompletedCardIds = completed
    ? challenge.cardIds
    : challenge.cardIds.filter((cardId) => completedCardIds.includes(cardId))
  return {
    id: challenge.id,
    title: challenge.title,
    focus: challenge.focus,
    detail: challenge.detail,
    cardIds: challenge.cardIds,
    completedCardIds: currentUserCompletedCardIds,
    completed,
    completedCount: new Set(aggregateCompletedIds).size,
    connectedCount,
    status: cleanText(metadata.challengeStatus) === 'scheduled'
      ? 'scheduled'
      : cleanText(metadata.challengeStatus) === 'closed'
        ? cleanText(metadata.scheduledForDate) && !cleanText(metadata.launchedAt) ? 'cancelled' : 'closed'
        : 'active',
    scheduledForDate: cleanText(metadata.scheduledForDate),
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

async function loadAvailabilityRequestSummaries(service: SupabaseClient, messageRows: MessageRow[]) {
  const requestIds = Array.from(new Set(messageRows.flatMap((row) => {
    if (!isMatchCardMetadata(row.metadata)) return []
    const requestId = cleanText(row.metadata.availabilityRequestId)
    return requestId ? [requestId] : []
  })))
  const summaries = new Map<string, TeamRoomAvailabilitySummary>()
  if (!requestIds.length) return summaries

  const [requestsResult, invitesResult, responsesResult] = await Promise.all([
    service
      .from('captain_availability_requests')
      .select('id,scenario_id,match_date')
      .in('id', requestIds),
    service
      .from('captain_availability_request_invites')
      .select('request_id,player_id,player_name')
      .in('request_id', requestIds),
    service
      .from('captain_availability_request_responses')
      .select('request_id,player_id,player_name,match_date,status,responded_at')
      .in('request_id', requestIds),
  ])
  if (requestsResult.error || invitesResult.error || responsesResult.error) return summaries

  for (const requestRow of requestsResult.data ?? []) {
    const requestId = cleanText(requestRow.id)
    if (!requestId) continue
    summaries.set(requestId, summarizeTeamRoomAvailability({
      matchDate: cleanText(requestRow.match_date),
      scenarioId: cleanText(requestRow.scenario_id),
      invites: (invitesResult.data ?? [])
        .filter((invite) => cleanText(invite.request_id) === requestId)
        .map((invite) => ({ playerId: invite.player_id, playerName: invite.player_name })),
      responses: (responsesResult.data ?? [])
        .filter((response) => cleanText(response.request_id) === requestId)
        .map((response) => ({
          playerId: response.player_id,
          playerName: response.player_name,
          matchDate: response.match_date,
          status: response.status,
          respondedAt: response.responded_at,
        })),
    }))
  }
  return summaries
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

async function loadCurrentFinalLineupAction(
  service: SupabaseClient,
  conversationId: string,
  announcementMessageId: string,
) {
  if (!announcementMessageId) {
    return { ok: false as const, status: 400, message: 'Choose the final lineup first.' }
  }
  const { data, error } = await service
    .from('internal_messages')
    .select('id,metadata')
    .eq('id', announcementMessageId)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }
  const metadata = data?.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {}
  const announcement = readTeamRoomLineupAnnouncement(metadata)
  if (!data || !announcement) {
    return { ok: false as const, status: 404, message: 'This final lineup is no longer available.' }
  }
  const card = await loadActionableMatchCard(service, conversationId, '')
  if (!card.ok) return card
  const receipt = readTeamRoomFinalLineupReceipt(card.metadata.finalLineup)
  if (!receipt) {
    return { ok: false as const, status: 409, message: 'This is not the current final lineup.' }
  }
  if (
    card.messageId !== announcement.sourceMessageId
    || receipt.announcementMessageId !== data.id
    || receipt.sourceMessageId !== card.messageId
  ) {
    return { ok: false as const, status: 409, message: 'This is not the current final lineup.' }
  }
  return {
    ok: true as const,
    announcement: { id: data.id, metadata },
    card,
    receipt,
  }
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
      ? [{
          profileId: participant.profile_id,
          needsResponse,
          needsMaybeFollowup,
          needsAckVersion,
          needsLineupChangeResponse: false,
        }]
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

async function sendFinalLineupReviewReminder(service: SupabaseClient, input: {
  conversationId: string
  sourceMessageId: string
  actorUserId: string
  recipientIds: string[]
  teamName: string
  scope: TeamLinkRow
  matchDate: string
  opponent: string
}) {
  const recipientIds = Array.from(new Set(input.recipientIds.map(cleanText).filter(Boolean)))
  if (!recipientIds.length) return { ok: true as const, notificationIds: [] as string[] }
  const href = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
    messageId: input.sourceMessageId,
  })
  const matchContext = [input.matchDate, input.opponent ? `vs ${input.opponent}` : ''].filter(Boolean).join(' ')
  const title = `${input.teamName} final lineup`
  const body = `Review the final lineup${matchContext ? ` for ${matchContext}` : ''} and tap Seen.`
  const { data, error } = await service.from('internal_notifications').insert(recipientIds.map((profileId) => ({
    recipient_profile_id: profileId,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body,
    href,
    conversation_id: input.conversationId,
  }))).select('id')
  if (error) return { ok: false as const, message: error.message }
  await sendTeamRoomPush(service, recipientIds, {
    title,
    body,
    href,
    tag: `team-room-final-lineup-${input.sourceMessageId}`,
  })
  return {
    ok: true as const,
    notificationIds: ((data ?? []) as Array<{ id?: string | null }>).map((row) => cleanText(row.id)).filter(Boolean),
  }
}

async function sendTeamLevelUpChallengeReminders(service: SupabaseClient, input: {
  conversationId: string
  messageId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  challenge: CaptainLevelUpChallenge
  recipientIds: string[]
}) {
  const href = buildTeamRoomHref({
    teamName: input.scope.team_name,
    leagueName: input.scope.league_name,
    flight: input.scope.flight,
    messageId: input.messageId,
  })
  const title = `${input.teamName} challenge reminder`
  const body = `Finish ${input.challenge.title}: open all ${input.challenge.cardIds.length} cards, then mark the challenge complete.`
  const { data } = await service.from('internal_notifications').insert(input.recipientIds.map((profileId) => ({
    recipient_profile_id: profileId,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title,
    body,
    href,
    conversation_id: input.conversationId,
  }))).select('id')
  await sendTeamRoomPush(service, input.recipientIds, {
    title,
    body,
    href,
    tag: `team-room-challenge-${input.messageId}`,
  })
  return ((data ?? []) as Array<{ id?: string | null }>).map((row) => cleanText(row.id)).filter(Boolean)
}

function buildTeamRoomActionQueue(
  members: Array<{ id: string; name: string; playerName?: string }>,
  message: ReturnType<typeof toMessage> | null,
) {
  const responseById = new Map((message?.responseDetails || []).map((row) => [row.profileId, row.response] as const))
  const externalSummary = message?.card?.availabilitySummary
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
    waitingCount: externalSummary?.waiting ?? waitingMembers.length,
    waitingNames: externalSummary?.waitingNames ?? waitingMembers.map((member) => member.name),
    maybeCount: externalSummary?.maybe ?? maybeMembers.length,
    maybeNames: externalSummary?.maybeNames ?? maybeMembers.map((member) => member.name),
    unseenLineupCount: unseenLineupMembers.length,
    unseenLineupNames: unseenLineupMembers.map((member) => member.name),
    lineupChangeCount: Array.isArray(message?.card?.lineupChanges) ? message.card.lineupChanges.length : 0,
    unresolvedCount: externalSummary
      ? externalSummary.waiting + externalSummary.maybe + unseenLineupMembers.length
      : unresolvedIds.size,
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

function isLevelUpChallengeMetadata(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const metadata = value as Record<string, unknown>
  return metadata.teamLevelUpChallenge === true && Boolean(cleanText(metadata.challengeId))
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
    matchId: cleanText(card.matchId).slice(0, 120),
    externalMatchId: cleanText(card.externalMatchId).slice(0, 120),
    lineup,
    availabilityRequestId: cleanText(card.availabilityRequestId),
    availabilityRequestUrl: cleanText(card.availabilityRequestUrl).slice(0, 500),
  }
}

function cleanLineupChangeContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const courtLabel = cleanText(row.courtLabel).slice(0, 80)
  const outgoingPlayerName = cleanText(row.outgoingPlayerName).slice(0, 120)
  const replacementPlayerName = cleanText(row.replacementPlayerName).slice(0, 120)
  return courtLabel && outgoingPlayerName && replacementPlayerName
    ? { courtLabel, outgoingPlayerName, replacementPlayerName }
    : null
}

function cleanStoredLineupChangeNotice(value: unknown): StoredLineupChangeNotice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const context = cleanLineupChangeContext(row)
  if (!context) return null
  const affectedNames = Array.isArray(row.affectedNames)
    ? Array.from(new Set(row.affectedNames.map((name) => cleanText(name).slice(0, 120)).filter(Boolean))).slice(0, 6)
    : []
  if (!affectedNames.length) return null
  return {
    ...context,
    affectedNames,
    beforePlayers: Array.isArray(row.beforePlayers)
      ? row.beforePlayers.map((name) => cleanText(name).slice(0, 120)).filter(Boolean).slice(0, 4)
      : [],
    afterPlayers: Array.isArray(row.afterPlayers)
      ? row.afterPlayers.map((name) => cleanText(name).slice(0, 120)).filter(Boolean).slice(0, 4)
      : [],
    pending: row.pending === true,
    notifiedAt: cleanText(row.notifiedAt),
    notifiedCount: Math.max(0, Math.floor(Number(row.notifiedCount) || 0)),
    response: cleanText(row.response) === 'accepted'
      ? 'accepted'
      : cleanText(row.response) === 'declined' ? 'declined' : '',
    respondedAt: cleanText(row.respondedAt),
    responderProfileId: cleanText(row.responderProfileId),
    responderName: cleanText(row.responderName).slice(0, 120),
    deadlineAt: cleanText(row.deadlineAt),
    deadlineStatus: cleanText(row.deadlineStatus) === 'scheduled'
      ? 'scheduled'
      : cleanText(row.deadlineStatus) === 'reminded'
        ? 'reminded'
        : cleanText(row.deadlineStatus) === 'answered' ? 'answered' : '',
    reminderSentAt: cleanText(row.reminderSentAt),
    publishedLineupChange: row.publishedLineupChange === true,
    previousFinalLineupId: cleanText(row.previousFinalLineupId),
    publishedAnnouncementMessageId: cleanText(row.publishedAnnouncementMessageId),
    publishedAt: cleanText(row.publishedAt),
    publishedByUserId: cleanText(row.publishedByUserId),
    publishedByName: cleanText(row.publishedByName).slice(0, 120),
  }
}

function buildLineupChangeShareText(notice: StoredLineupChangeNotice) {
  return `${notice.courtLabel} lineup update: ${notice.replacementPlayerName} is in for ${notice.outgoingPlayerName}. New court: ${notice.afterPlayers.join(' / ')}.`
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

function cleanChallengeMatchDate(value: unknown) {
  const matchDate = cleanText(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return ''
  const parsed = new Date(`${matchDate}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === matchDate
    ? matchDate
    : ''
}
