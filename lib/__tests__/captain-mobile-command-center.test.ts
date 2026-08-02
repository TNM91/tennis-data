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
    expect(page).toContain("label: 'Add scorecard'")
    expect(page).toContain('<span>More</span>')
    expect(page).toContain('Pairings, setup, and extras')
    expect(page).not.toContain('More captain tools')
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(styles).toContain('min-height: 66px;')
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
