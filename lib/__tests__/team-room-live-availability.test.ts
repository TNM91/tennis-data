import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8').replaceAll('\r\n', '\n')
}

describe('Team Room live availability card', () => {
  it('uses the private availability request as the projected-lineup response source', () => {
    const roomApi = readSource('app/api/team-rooms/route.ts')
    const availabilityApi = readSource('app/api/captain/availability-requests/route.ts')

    expect(roomApi).toContain('loadAvailabilityRequestSummaries')
    expect(roomApi).toContain(".from('captain_availability_request_invites')")
    expect(roomApi).toContain(".from('captain_availability_request_responses')")
    expect(roomApi).toContain('summarizeTeamRoomAvailability({')
    expect(availabilityApi).toContain("url.searchParams.get('requestId')")
    expect(availabilityApi).toContain('canManageSharedAvailabilityRequest')
  })

  it('keeps both captain follow-up actions on the live card', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const messagingPage = readSource('app/captain/messaging/page.tsx')

    expect(roomPage).toContain('Nudge {waiting} waiting')
    expect(roomPage).toContain('Update lineup')
    expect(roomPage).toContain('availabilityRequest')
    expect(roomPage).toContain("focus: 'waiting'")
    expect(roomPage).toContain('aria-label="Availability response summary"')
    expect(roomPage).toContain('Match replies')
    expect(roomPage).toContain('See player statuses')
    expect(roomPage).toContain('Find replacement')
    expect(roomPage).toContain('buildCaptainReplyReviewHref({')
    expect(messagingPage).toContain("params.get('availabilityRequest')")
    expect(messagingPage).toContain("params.set('requestId', requestedAvailabilityRequestId)")
    expect(messagingPage).toContain("params.get('focus') === 'waiting'")
    expect(messagingPage).toContain("getElementById('potential-lineup-confirm-title')")
  })

  it('opens the exact reply as an actionable Captain replacement review', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const captainPage = readSource('app/captain/page.tsx')
    const roomStyles = readSource('app/team-room/team-room.module.css')

    expect(roomPage).toContain("notice: CAPTAIN_AVAILABILITY_REPLY_NOTICE")
    expect(roomPage).toContain("source: 'team_room'")
    expect(roomPage).toContain("status: group.status === 'no' ? 'unavailable' : 'maybe'")
    expect(roomPage).toContain('needs the first decision.')
    expect(captainPage).toContain("searchParams.get('notice') !== CAPTAIN_AVAILABILITY_REPLY_NOTICE")
    expect(captainPage).toContain("id: 'team-room-reply-focus'")
    expect(captainPage).toContain("document.getElementById('captain-reply-alert')")
    expect(captainPage).toContain("target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })")
    expect(roomStyles).toContain('.replyDigest')
    expect(roomStyles).toContain('.replyPriority')
  })

  it('keeps a saved replacement silent until the captain notifies affected players', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const roomApi = readSource('app/api/team-rooms/route.ts')
    const roomStyles = readSource('app/team-room/team-room.module.css')

    expect(roomApi).toContain("if (action === 'notify_lineup_change')")
    expect(roomApi).toContain('const silent = body.silent === true')
    expect(roomApi).toContain('if (!silent) {')
    expect(roomApi).toContain('buildLineupChangeNotice(previousCard.lineup, effectiveCard.lineup, changeContext)')
    expect(roomApi).toContain('notifyAffectedLineupPlayers')
    expect(roomApi).toContain('directShareNames')
    expect(roomPage).toContain('Ready to notify affected players')
    expect(roomPage).toContain('Notify ${lineupChangeNotice.affectedNames.length} affected')
    expect(roomPage).toContain("action: 'notify_lineup_change'")
    expect(roomStyles).toContain('.lineupChangePending')
    expect(roomStyles).toContain('.lineupChangeSent')
  })

  it('lets the linked replacement answer and reopens the exact court after a decline', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const roomApi = readSource('app/api/team-rooms/route.ts')
    const roomStyles = readSource('app/team-room/team-room.module.css')

    expect(roomApi).toContain("if (action === 'respond_lineup_change')")
    expect(roomApi).toContain('Only the replacement player can answer this lineup change.')
    expect(roomApi).toContain("response === 'accepted' ? 'yes' : 'no'")
    expect(roomApi).toContain('notifyManagersOfLineupChangeResponse')
    expect(roomPage).toContain("action: 'respond_lineup_change'")
    expect(roomPage).toContain('Can you play this court?')
    expect(roomPage).toContain('Find another player')
    expect(roomPage).toContain("lineupChangeNotice?.response === 'declined'")
    expect(roomStyles).toContain('.lineupChangeDecision')
    expect(roomStyles).toContain('.lineupChangeDeclined')
  })

  it('schedules one free replacement reminder and flags an unanswered court', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const roomApi = readSource('app/api/team-rooms/route.ts')
    const reminderRunner = readSource('app/api/team-rooms/reminders/route.ts')
    const roomStyles = readSource('app/team-room/team-room.module.css')

    expect(roomApi).toContain("if (action === 'schedule_lineup_change_deadline')")
    expect(roomApi).toContain('needsLineupChangeResponse: true')
    expect(roomApi).toContain("status: 'cancelled'")
    expect(roomPage).toContain('Reply by')
    expect(roomPage).toContain('TIQ will check that morning.')
    expect(roomPage).toContain('Response overdue')
    expect(roomPage).toContain('Review this court')
    expect(reminderRunner).toContain('target.needsLineupChangeResponse && !lineupChangeAnswered')
    expect(reminderRunner).toContain("deadlineStatus: 'reminded'")
    expect(reminderRunner).toContain('Accept or choose Can’t play')
    expect(roomStyles).toContain('.lineupChangeDeadline')
    expect(roomStyles).toContain('.lineupChangeOverdue')
  })

  it('opens reply alerts on the exact card and highlights the affected court', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const roomStyles = readSource('app/team-room/team-room.module.css')
    const roomApi = readSource('app/api/team-rooms/route.ts')

    expect(roomPage).toContain("searchParams.get('message')")
    expect(roomPage).toContain('match-card-${message.id}')
    expect(roomPage).toContain('replied {focusedStatusLabel}')
    expect(roomPage).toContain('styles.lineupRowFocused')
    expect(roomStyles).toContain('.matchCardFocused')
    expect(roomStyles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(roomApi).toContain('teamRoomMessageId: input.messageId')
    expect(roomApi).toContain('findCaptainReplyCourt(input.metadata.lineup')
  })

  it('summarizes every court before showing detailed player replies', () => {
    const roomPage = readSource('app/team-room/page.tsx')
    const roomStyles = readSource('app/team-room/team-room.module.css')

    expect(roomPage).toContain('buildTeamRoomCourtReadiness({')
    expect(roomPage).toContain('Lineup readiness')
    expect(roomPage).toContain('Needs captain')
    expect(roomPage).toContain('Player reply details')
    expect(roomPage).toContain('courtReadinessAnchor(message.id, index)')
    expect(roomStyles).toContain('.courtReadinessGrid')
    expect(roomStyles).toContain('.courtReadinessCaptain')
    expect(roomStyles).toContain('.readinessReplyDetails')
    expect(roomStyles).toContain('.lineupRow:target')
  })
})
