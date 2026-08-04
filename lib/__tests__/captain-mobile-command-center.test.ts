import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain mobile command center', () => {
  const page = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'app/captain/captain-mobile-command.module.css'), 'utf8')
  const connectionBanner = readFileSync(join(process.cwd(), 'app/components/team-connection-invite.tsx'), 'utf8')

  it('puts the four recurring captain jobs on one compact mobile surface', () => {
    expect(page).toContain('aria-label="Captain mobile command center"')
    expect(page).toContain('aria-label="Captain one tap actions"')
    expect(page).toContain("label: 'Who can play'")
    expect(page).toContain("label: 'Team chat'")
    expect(page).toContain('teamRoomSummary.unreadCount')
    expect(page).toContain('teamRoomSummary.pendingCount')
    expect(page).toContain("summary=1")
    expect(page).toContain('Courts needing captain attention')
    expect(page).toContain('captainUnresolvedCourts.map')
    expect(page).toContain("court.status === 'needs_captain'")
    expect(page).toContain("messageId: captainCourtReadiness?.messageId || ''")
    expect(page).toContain('court: courtLabel')
    expect(page).toContain('handleCaptainTeamRoomNav(courtHref)')
    expect(page).toContain('selectPrimaryTeamRoomCourtReadiness(captainUnresolvedCourts)')
    expect(page).toContain('const captainHomePrimaryAction = captainCourtPrimaryAction ||')
    expect(page).toContain('const captainHomePrimaryStatus = captainCourtPrimaryAction')
    expect(page).toContain('onClick={() => handleCaptainTeamRoomNav(captainPrimaryCourtHref)}')
    expect(page).toContain("'court' : 'courts'} open")
    expect(page).toContain('const loadTeamRoomSummary = useCallback(async () =>')
    expect(page).toContain('requestId !== teamRoomSummaryRequestRef.current')
    expect(page).toContain("document.addEventListener('visibilitychange', refreshVisibleTeamRoomSummary)")
    expect(page).toContain("window.addEventListener('pageshow', refreshRestoredTeamRoomSummary)")
    expect(page).toContain('window.setInterval(refreshVisibleTeamRoomSummary, TEAM_ROOM_SUMMARY_REFRESH_MS)')
    expect(page).not.toContain('window.location.reload()')
    expect(page).toContain("label: 'Add scorecard'")
    expect(page).toContain('<span>More</span>')
    expect(page).toContain('Pairings, setup, and extras')
    expect(page).not.toContain('More captain tools')
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(styles).toContain('min-height: 66px;')
    expect(styles).toContain('.readinessGrid')
    expect(styles).toContain('minmax(min(100%, 118px), 1fr)')
    expect(styles).toContain('.attentionBadgeButton')
  })

  it('hides the catalog-style Captain surfaces and overlapping action bar on phones', () => {
    expect(page).toContain('{!isMobile ? (')
    expect(page).toContain("display: 'none',")
    expect(page).toContain('{captainMobileCommandCenter}')
  })

  it('turns the already-open Captain connection action into Team Chat', () => {
    expect(connectionBanner).toContain("import { buildTeamRoomHref } from '@/lib/team-room'")
    expect(connectionBanner).toContain("isCaptainConnection ? 'Open Team Chat' : 'Continue with team'")
    expect(connectionBanner).toContain("alreadyAtDestination ? teamRoomHref")
    expect(connectionBanner).toContain('.team-connection-invite-banner.is-accepted .team-connection-invite-body')
  })
})
