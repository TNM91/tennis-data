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
    expect(messagingPage).toContain("params.get('availabilityRequest')")
    expect(messagingPage).toContain("params.set('requestId', requestedAvailabilityRequestId)")
    expect(messagingPage).toContain("params.get('focus') === 'waiting'")
    expect(messagingPage).toContain("getElementById('potential-lineup-confirm-title')")
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
})
