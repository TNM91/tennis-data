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

  it('keeps a private court ask inside the Builder and texts each selected player separately', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain('async function askProposedCourtPlayers(\n    slot: LineupSlot,\n    invitedPlayer: LineupSlot[\'players\'][number],')
    expect(source).toContain('slots: [slot]')
    expect(source).toContain('const [askingCourtId, setAskingCourtId] = useState(\'\')')
    expect(source).toContain('const [preparedCourtTexts, setPreparedCourtTexts] = useState<Record<string, PreparedCourtText>>({})')
    expect(source).toContain('onAskPlayers={askProposedCourtPlayers}')
    expect(source).toContain('TiQ keeps the court selected while it prepares each private reply link.')
    expect(source).toContain('inviteMode: \'append\'')
    expect(source).toContain('CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY')
    expect(source).toContain('const directTextHandoff: CaptainDirectCourtTextHandoff = {')
    expect(source).toContain('const responseToken = window.crypto.randomUUID()')
    expect(source).not.toContain('keepalive: true')
    expect(source).toContain('const preservedTeamSlots = cloneSlots(teamSlots.map((currentSlot) =>')
    expect(source).toContain('saveDirectCourtTextHandoff(directTextHandoff)')
    expect(source).toContain('const persistedBuilderDraft = persistedDirectCourtTextHandoff?.builderDraft')
    expect(source).toContain('const persistedDeviceBuilderDraft =')
    expect(source).toContain('getCaptainLineupDraftStorageKey(userId)')
    expect(source).toContain("setMessage('Draft restored on this device.')")
    expect(source).toContain("player.playerName || 'Saved player'")
    expect(source).toContain('saved draft</option>')
    expect(source).toContain('teamSlots: preservedTeamSlots')
    expect(source).toContain('text ${nextDirectCourtTextPlayer.playerName} next.')
    expect(source).toContain('href={preparedText.href}')
    expect(source).toContain('onClick={() => onOpenPreparedCourtText(preparedText)}')
    expect(source).toContain('openNativeSmsHandoff(contact.phone, player.playerName, body)')
  })

  it('refreshes player replies when the captain returns to the Builder', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain('const refreshAvailabilityReplies = useCallback(async (quiet = false) =>')
    expect(source).toContain("window.addEventListener('focus', refreshWhenVisible)")
    expect(source).toContain("window.addEventListener('pageshow', refreshWhenVisible)")
    expect(source).toContain("document.addEventListener('visibilitychange', refreshWhenVisible)")
    expect(source).toContain("'Refresh replies'")
    expect(source).toContain('Player replies are up to date.')
  })

  it('automatically anchors confirmed players while retaining a deliberate captain unlock', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain("const [releasedConfirmedPlayerIds, setReleasedConfirmedPlayerIds] = useState<string[]>([])")
    expect(source).toContain('const confirmedAssignedPlayerIdSet = useMemo(() =>')
    expect(source).toContain('const autoLockedConfirmedPlayerIdSet = useMemo(')
    expect(source).toContain("availabilityLabel(availabilityMap.get(player.playerId)?.status) === 'Confirmed'")
    expect(source).toContain("isAutoLocked ? 'confirmed · unlock'")
    expect(source).toContain("isConfirmedReleased ? 're-lock confirmed player' : 'lock player'")
    expect(source).toContain('Confirmed players lock automatically.')
    expect(source).toContain("selectedReplyLabel === 'Confirmed'\n                ? { ...slotPlayerRowStyle, ...confirmedPlayerRowStyle }")
    expect(source).toContain('const confirmedPlayerRowStyle: CSSProperties = {')
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

  it('makes the final lineup readiness clear before a captain sends the team details', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain('const assignedTeamReplySummary = useMemo(() =>')
    expect(source).toContain('const finalLineupReady = completedCourtCount === analysis.lines.length')
    expect(source).toContain('Final lineup check')
    expect(source).toContain('Every court is set and every selected player is in.')
    expect(source).toContain('Review final lineup')
    expect(source).toContain('Check replies')
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
    expect(source).toContain('requestedAvailabilityRequestId || availabilityHandoff?.availabilityRequestId')
    expect(source).toContain('statusPriority[left.status] - statusPriority[right.status] || left.originalIndex - right.originalIndex')
  })

  it('lets invited players answer future match dates without signing in', () => {
    const page = readSource('app/availability/[token]/availability-response-client.tsx')
    const route = readSource('app/api/captain/availability-requests/[token]/route.ts')

    expect(page).toContain('Set your availability')
    expect(page).toContain('One-tap reply')
    expect(page).toContain('Yes, I’m in')
    expect(page).toContain('No, I’m out')
    expect(page).toContain('Add calendar reminder')
    expect(page).toContain('Thanks—your response was saved.')
    expect(page).toContain('It was sent to your captain.')
    expect(page).toContain('Future availability')
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
    expect(collectionRoute).toContain("body.inviteMode === 'append'")
    expect(collectionRoute).toContain('responseToken: cleanAvailabilityText(player.responseToken, 80)')
    expect(collectionRoute).toContain('response_token: player.responseToken')
    expect(migration).toContain('response_token uuid not null default gen_random_uuid() unique')
  })
})
