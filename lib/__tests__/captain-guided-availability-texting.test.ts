import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')

describe('Captain guided availability texting', () => {
  it('keeps a persisted next-player queue for the free native SMS handoff', () => {
    expect(source).toContain("const POTENTIAL_LINEUP_TEXT_QUEUE_STORAGE_PREFIX = 'tenaceiq_potential_lineup_text_queue'")
    expect(source).toContain('setOpenedPotentialPlayerKeys(readLocal<string>(potentialTextQueueStorageKey))')
    expect(source).toContain('writeLocal(potentialTextQueueStorageKey, next)')
    expect(source).toContain('Text next: {nextPotentialTextTarget.playerName.split(\' \')[0]}')
    expect(source).toContain('TiQ keeps your place and replies appear here automatically.')
    expect(source).toContain('{!availabilityHandoff && !liveAvailabilityRequest?.request ? (')
    expect(source).toContain('<GhostLink href="/captain/lineup-builder">Edit lineup</GhostLink>')
  })

  it('puts players needing captain attention ahead of completed replies', () => {
    expect(source).toContain('unavailable: 0')
    expect(source).toContain('maybe: 1')
    expect(source).toContain('waiting: 2')
    expect(source).toContain('available: 3')
    expect(source).toContain('potentialLineupQueue.map(({ playerName, playerKey, contact, canText, liveResponse })')
  })

  it('captures a missing mobile number on the player card and opens the prepared text', () => {
    expect(source).toContain('async function savePotentialPlayerPhone(playerName: string)')
    expect(source).toContain('type="tel"')
    expect(source).toContain("{savingInlinePhoneKey === playerKey ? 'Saving...' : 'Save & text'}")
    expect(source).toContain('const contactSave = saveContacts(nextContacts)')
    expect(source).toContain('prepareSmsBodyForNativeComposer(potentialMessage)')
    expect(source).toContain('window.location.href = smsHref')
    expect(source.indexOf('window.location.href = smsHref')).toBeLessThan(source.indexOf('await contactSave'))
    expect(source).toContain("opt_in_text: true")
    expect(source).not.toContain('open={Boolean(availabilityHandoff && missingPotentialLineupNames.length) || undefined}')
  })

  it('prepares a durable private court text before exposing a native Messages tap in the Builder', () => {
    const builderSource = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

    expect(builderSource).toContain("const [preparedCourtTexts, setPreparedCourtTexts] = useState<Record<string, PreparedCourtText>>({})")
    expect(builderSource).toContain('const preparedKey = getPreparedCourtTextKey(slot, invitedPlayer)')
    expect(builderSource).toContain('const responseToken = window.crypto.randomUUID()')
    expect(builderSource).toContain("const response = await fetch('/api/captain/availability-requests'")
    expect(builderSource).toContain('const requestUrl = result?.playerRequestUrls?.find')
    expect(builderSource).toContain('prepareSmsBodyForNativeComposer(body)')
    expect(builderSource).toContain('function openPreparedCourtText(preparedText: PreparedCourtText)')
    expect(builderSource).toContain('href={preparedText.href}')
    expect(builderSource).toContain('event.preventDefault()')
    expect(builderSource).toContain('openNativeSmsHandoff(preparedText.phone, preparedText.playerName, preparedText.body)')
    expect(builderSource).not.toContain('keepalive: true')
    expect(builderSource).toContain('href={smsFallback.href}')
    expect(builderSource).toContain('Open Messages for')
    expect(builderSource).toContain("responseToken: player.playerId === invitedPlayer.playerId")
    expect(builderSource).toContain('const { data: sessionData } = await supabase.auth.getSession()')
    expect(builderSource).toContain('Draft restoration should be just as ready to text as a fresh player')
    expect(builderSource).toContain('void askProposedCourtPlayers(slot, player, { silent: true })')
  })

  it('records structured availability request lifecycle logs for production diagnosis', () => {
    const routeSource = readFileSync(join(process.cwd(), 'app/api/captain/availability-requests/route.ts'), 'utf8')

    expect(routeSource).toContain("[api/captain/availability-requests] incoming")
    expect(routeSource).toContain("[api/captain/availability-requests] created")
    expect(routeSource).toContain("[api/captain/availability-requests] invite upsert failed")
  })

  it('keeps the queue and inline form within mobile width', () => {
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))'")
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(source).toContain('const potentialInlinePhoneFormStyle: CSSProperties = {')
  })
})
