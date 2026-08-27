import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamsHub = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')
const teamDetail = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const teamRoom = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
const teamRoomStyles = readFileSync(join(process.cwd(), 'app/team-room/team-room.module.css'), 'utf8')
const matchWeekRail = readFileSync(join(process.cwd(), 'app/components/captain-match-week-rail.tsx'), 'utf8')
const lineupBuilder = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const portal = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const teamConnectionsClient = readFileSync(join(process.cwd(), 'lib/team-profile-links-client.ts'), 'utf8')

describe('Teams experience simplification', () => {
  it('puts connected teams ahead of redundant access messaging', () => {
    expect(teamsHub).toContain("!loading && !connectionError && (!userId || groupedTeams.length === 0)")
    expect(teamsHub).toContain('groupedTeams.length > 0 && pendingConnections.length > 0')
    expect(teamsHub.indexOf('id="tiq-entered-teams"')).toBeLessThan(
      teamsHub.lastIndexOf('<TeamAccountAccessPanel'),
    )
  })

  it('keeps team sections visible without horizontal phone scrolling', () => {
    expect(teamDetail).toContain('teamSectionNavMobileStyle')
    expect(teamDetail).toContain("gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'")
    expect(teamDetail).toContain('teamSectionNavLinkMobileStyle')
    expect(teamDetail).toContain("whiteSpace: 'normal'")
    expect(teamDetail).toContain('aria-label="Team activity filter"')
    expect(teamDetail).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(teamDetail).toContain('activityFilterButtonActiveStyle')
  })

  it('keeps upcoming matches and results easy to isolate on phones', () => {
    expect(teamDetail).toContain("type TeamActivityFilter = 'all' | 'upcoming' | 'results'")
    expect(teamDetail).toContain("const [activityFilter, setActivityFilter] = useState<TeamActivityFilter>('all')")
    expect(teamDetail).toContain("query.get('activity')")
    expect(teamDetail).toContain("query.set('activity', activityFilter)")
    expect(teamDetail).toContain("activityFilter === 'upcoming'")
    expect(teamDetail).toContain("activityFilter === 'results'")
    expect(teamDetail).toContain('setShowFullMatchHistory(false)')
  })

  it('keeps the primary team action in the hero and moves repeated tools down the page on phones', () => {
    expect(teamDetail).toContain('<PrimaryLink href="#team-chat">Open Team Chat</PrimaryLink>')
    expect(teamDetail).toContain('!isMobile && access.canUseAdvancedPlayerInsights')
    expect(teamDetail).toContain('!isMobile && canManageThisTeam')
  })

  it('keeps chat message controls and alert prompts from crowding the conversation', () => {
    expect(teamRoom).toContain('className={styles.messageMoreActions}')
    expect(teamRoom).toContain('<summary>More</summary>')
    expect(teamRoomStyles).toContain('.messageMoreMenu')
    expect(teamRoomStyles).toContain('position: static')
    expect(teamRoomStyles).toContain('overflow-x: visible')
  })

  it('compresses the match-week path and secondary lineup actions on phones', () => {
    expect(matchWeekRail).toContain('mobileStepList')
    expect(matchWeekRail).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(matchWeekRail).toContain("return 'Confirm'")
    expect(lineupBuilder).toContain('<summary style={builderMoreActionsSummaryStyle}>More lineup actions</summary>')
    expect(lineupBuilder).toContain('builderMobileActionStackStyle')
  })

  it('opens mobile Teams without a staging hero or duplicate active lanes', () => {
    expect(teamsHub).toContain('compactHome={isMobile}')
    expect(teamsHub).toContain('<h1 style={mobileTeamsTitleStyle}>')
    expect(portal).toContain("shortcut.kind === 'lane'")
    expect(portal).toContain('shortcut.laneId === activeLane.id')
    expect(portal).toContain('prefetch')
  })

  it('shows accepted teams before slower directory enrichment finishes', () => {
    expect(teamsHub).toContain('async function loadConnections()')
    expect(teamsHub).toContain('async function loadSupportingTeamContext(connectedTeams: TeamConnection[])')
    expect(teamsHub).toContain('loadConnectedTeamDirectoryOptions')
    expect(teamsHub).toContain("label: 'Team connection'")
    expect(teamsHub).toContain("'Match data syncing'")
    expect(teamsHub).toContain('<TeamListLoadingState />')
    expect(teamConnectionsClient).toContain('TEAM_CONNECTIONS_CACHE_TTL_MS')
    expect(teamConnectionsClient).toContain('preloadTeamConnections')
    expect(portal).toContain('preloadTeamConnections(accessToken, { userId })')
    expect(teamsHub).toContain('buildTeamProfileHref(group.teamName')
    expect(teamsHub).not.toContain('`/team/${encodeURIComponent(group.teamName)}')
  })
})
