import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8').replaceAll('\r\n', '\n')
}

describe('Captain projected lineup confirmation flow', () => {
  it('saves the exact potential lineup before opening availability messaging', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain('async function saveAndConfirmPotentialLineupAvailability()')
    expect(source).toContain('const savedScenario = await saveScenario(false, true)')
    expect(source).toContain('Potential lineup - ${formatDate(matchDate || null)}')
    expect(source).toContain("window.localStorage.setItem(CAPTAIN_LINEUP_HANDOFF_STORAGE_KEY")
    expect(source).toContain("return 'Save & ask players'")
    expect(source).toContain("setConfirmationStage('saving-lineup')")
    expect(source).toContain("setConfirmationStage('preparing-replies')")
    expect(source).toContain("setConfirmationStage('opening-messages')")
    expect(source).toContain("hrefUrl.searchParams.set('message', teamRoomMessageId)")
    expect(source).toContain('hrefUrl.hash = `match-card-${encodeURIComponent(teamRoomMessageId)}`')
    expect(source).toContain('router.push(teamRoomCardHref)')
  })

  it('returns to the exact Team Room card before the captain sends the lineup', () => {
    const builder = readSource('app/captain/lineup-builder/page.tsx')
    const room = readSource('app/team-room/page.tsx')

    expect(builder).toContain("setMessage('Opening Team Room...')")
    expect(room).toContain("action: 'send_final_lineup'")
    expect(room).toContain("'Send lineup to team'")
    expect(room).toContain('isCaptainLineupLocked({')
    expect(room).toContain('buildCaptainLockedLineupId({ messageId: message.id, lineup: card.lineup })')
    expect(room).toContain("'Lineup sent to the team.'")
  })

  it('syncs a saved suggested replacement before offering targeted delivery', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain('syncSavedSuggestedSwapToTeamRoom')
    expect(source).toContain("action: 'post_match_card'")
    expect(source).toContain('silent: true')
    expect(source).toContain('Team Chat is ready to notify the affected players.')
    expect(source).toContain('Notify ${savedLineupChangeDelivery.affectedNames.length} affected')
    expect(source).toContain("action: 'notify_lineup_change'")
    expect(source).toContain("fetch('/api/internal-notifications/email-fallback'")
  })

  it('opens messaging as an availability request rather than a final lineup announcement', () => {
    const source = readSource('app/captain/messaging/page.tsx')

    expect(source).toContain("setMessageTitle('Potential lineup availability')")
    expect(source).toContain("setRecipientMode('custom')")
    expect(source).toContain('setSelectedRecipientIds(matchingContactIds)')
    expect(source).toContain('buildPotentialLineupAvailabilityMessage({')
    expect(source).toContain("`Text ${playerName.split(' ')[0]}`")
    expect(source).toContain('Text next: {nextPotentialTextTarget.playerName.split')
    expect(source).toContain('Record ${playerName}\'s reply')
    expect(source).toContain('Refresh responses')
    expect(source).toContain("window.addEventListener('pageshow', refreshWhenVisible)")
  })

  it('lets invited players answer future match dates without signing in', () => {
    const page = readSource('app/availability/[token]/availability-response-client.tsx')
    const route = readSource('app/api/captain/availability-requests/[token]/route.ts')

    expect(page).toContain('Set your availability')
    expect(page).toContain("fetch(`/api/captain/availability-requests/${encodeURIComponent(token)}`")
    expect(page).toContain('Want fewer availability texts?')
    expect(page).not.toContain('useAuth')
    expect(route).toContain("captain_availability_request_responses")
    expect(route).toContain(".from('lineup_availability')")
    expect(route).toContain(".from('internal_notifications')")
    expect(route).toContain('lockedPlayer: loaded.lockedPlayer')
  })

  it('creates private response links and lets captains reopen the live board', () => {
    const collectionRoute = readSource('app/api/captain/availability-requests/route.ts')
    const migration = readSource('supabase/migrations/20260801000300_create_captain_availability_request_invites.sql')

    expect(collectionRoute).toContain('export async function GET(request: Request)')
    expect(collectionRoute).toContain(".from('captain_availability_request_invites')")
    expect(collectionRoute).toContain('playerRequestUrls:')
    expect(migration).toContain('response_token uuid not null default gen_random_uuid() unique')
  })
})
