import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPlayerDetailHref, buildTiqLeagueDetailHref } from '../entity-routes'
import { buildTeamProfileHref } from '../team-routes'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('entity detail linking', () => {
  it('builds stable team profile links with available public context', () => {
    expect(buildTeamProfileHref('Ace/Deuce', {
      layer: 'tiq',
      league: 'City League',
      flight: '4.0',
    })).toBe('/teams/Ace~2FDeuce?layer=tiq&league=City+League&flight=4.0')
  })

  it('builds direct player and league links with useful search fallbacks', () => {
    expect(buildPlayerDetailHref('player/42', 'Avery Stone')).toBe('/players/player%2F42')
    expect(buildPlayerDetailHref('', 'Avery Stone')).toBe('/explore/players?q=Avery%20Stone')
    expect(buildPlayerDetailHref('', '')).toBe('/explore/players')
    expect(buildTiqLeagueDetailHref('summer/ladder')).toBe(
      '/explore/leagues/tiq/summer%2Fladder?league_id=summer%2Fladder',
    )
  })

  it('uses one accessible interaction treatment for entity names', () => {
    const componentSource = source('app/components/entity-detail-link.tsx')
    const styleSource = source('app/components/entity-detail-link.module.css')

    expect(componentSource).toContain('data-entity-detail-link="true"')
    expect(styleSource).toContain('.link:hover')
    expect(styleSource).toContain('.link:focus-visible')
    expect(styleSource).toContain('touch-action: manipulation')
  })

  it('links named players, teams, leagues, and tournament entrants on primary surfaces', () => {
    const exploreSource = source('app/explore/page.tsx')
    const teamDetailSource = source('app/teams/[team]/page.tsx')
    const playerDetailSource = source('app/players/[id]/page.tsx')
    const leagueDetailSource = source('app/explore/leagues/tiq/[league]/page.tsx')
    const resultsSource = source('app/compete/results/page.tsx')
    const tournamentSource = source('app/tournaments/[id]/page.tsx')
    const individualBookSource = source('app/components/individual-league-results-workspace.tsx')
    const teamBookSource = source('app/components/team-league-results-workspace.tsx')

    expect(exploreSource).toContain("size={mobile ? 'sm' : 'md'}")
    expect(teamDetailSource).toContain("<EntityDetailLink href={`/players/${encodeURIComponent(player.id)}`}>")
    expect(teamDetailSource).toContain('<EntityDetailLink href={buildTeamProfileHref(opp.name)}>')
    expect(teamDetailSource).toContain('href={buildTeamProfileHref(match.opponent, {')
    expect(playerDetailSource).toContain("<EntityDetailLink href={`/players/${encodeURIComponent(opp.id)}`}")
    expect(playerDetailSource).not.toContain('<Link href="/mylab" style={rivalryNameLinkStyle}>{opp.name}</Link>')
    expect(leagueDetailSource).toContain('href={buildTeamProfileHref(entry.teamName, {')
    expect(leagueDetailSource).toContain('href={buildPlayerDetailHref(entry.playerId, entry.playerName)}')
    expect(leagueDetailSource).toContain('href={buildTeamProfileHref(row.teamName, {')
    expect(leagueDetailSource).toContain('href={buildTeamProfileHref(event.teamAName, {')
    expect(leagueDetailSource).toContain('href={buildTeamProfileHref(event.teamBName, {')
    expect(resultsSource).toContain('href={buildPlayerDetailHref(result.winnerPlayerId, result.winnerPlayerName)}')
    expect(resultsSource).toContain('href={buildTiqLeagueDetailHref(result.leagueId)}')
    expect(tournamentSource).toContain('function TournamentEntrantLink({')
    expect(tournamentSource).toContain("record.entrantType === 'teams'")
    expect(individualBookSource).toContain('href={buildPlayerDetailHref(entry.playerId, entry.playerName)}')
    expect(teamBookSource).toContain('href={buildTeamProfileHref(event.teamAName)}')
    expect(teamBookSource).toContain('href={buildPlayerDetailHref(line.sideAPlayer1Id, line.sideAPlayer1Name)}')
  })
})
