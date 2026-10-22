import { describe, expect, it } from 'vitest'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'
import { additionalSourceRosterListings, sourceRosterCountKey, sourceRosterForScope, sourceRosterTeamKey } from '../source-roster-scope'
import { normalizeTennisIdentity } from '../tennisrecord/reconcile'

const base = 'https://www.tennisrecord.com/adult/'
const teamUrl = base + 'teamprofile.aspx?teamname=Example%20(F)&year=2027'
const row = (name: string) => `<tr><td><a href="/adult/profile.aspx?playername=${name}&amp;s=2">${name}</a></td><td>St. Louis, MO</td><td>4.5</td><td>1-0</td><td>0-0</td><td>1-0</td><td>1-0</td><td>4.6123</td></tr>`
const table = `<table><tr><th>Name</th><th>Location</th><th>NTRP</th><th>2027<br>Record</th><th>Local Singles</th><th>Local Doubles</th><th>Local Record</th><th>Rating</th></tr>${row('Taylor Smith')}${row("Jamie O'Neill")}</table>`
const heading = `<table><tr><td>Team Profile</td></tr></table><table><tr><td><a href="/adult/league.aspx?flightname=Men 4.5 (F)&amp;year=2027">2027 Adult 18 &amp; Over Fall (Men 4.5 (F))</a></td></tr><tr><td>Example (F)</td></tr></table>`
const html = heading + table + table

describe('current source team roster', () => {
  it('retains roster-only listings beside tracked players without joining unresolved names', () => {
    const listed = [{ canonical_player_id: 'tracked', player_name: 'Taylor' }, { canonical_player_id: 'unplayed', player_name: 'Jamie' }, { canonical_player_id: null, player_name: 'Taylor' }]
    expect(additionalSourceRosterListings(listed, ['tracked'])).toEqual(listed.slice(1))
    expect(additionalSourceRosterListings(listed, [])).toEqual(listed)
  })
  it('recognizes the verified current layout and deduplicates desktop/mobile copies', () => {
    const parsed = parseTennisRecordMatchPage(html, teamUrl)
    expect(parsed.teamMembers).toHaveLength(2)
    expect(parsed.teamMembers[0]).toMatchObject({ teamName: 'Example (F)', name: 'Taylor Smith', seasonYear: 2027,
      leagueName: '2027 Adult 18 & Over Fall', flight: 'Men 4.5 (F)', sourceUrl: teamUrl,
      profileSourceUrl: base + 'profile.aspx?playername=Taylor%20Smith&s=2' })
    expect(parsed.players.map(p => p.sourceUrl)).toEqual(parsed.teamMembers.map(m => m.profileSourceUrl))
    expect(parsed.players.every(p => p.publishedRating === undefined && p.ntrpLabel === '' && p.state === '')).toBe(true)
    expect(parsed.matches).toEqual([])
    expect(parsed.discoveredUrls).toEqual(parsed.teamMembers.map(m => m.profileSourceUrl))
  })

  it.each([
    ['unverified owner', html.replace('<td>Example (F)</td>', '<td>Other (F)</td>')],
    ['wrong year', html.replaceAll('year=2027', 'year=2026')],
    ['wrong record year', html.replaceAll('2027<br>Record', '2026<br>Record')],
    ['unrelated table', html.replaceAll('<th>NTRP</th>', '<th>Matches</th>')],
    ['external league', html.replace('href="/adult/league.aspx', 'href="https://example.com/adult/league.aspx')],
    ['missing heading', html.replace('<td>Team Profile</td>', '<td>Player Search</td>')],
  ])('rejects %s rather than guessing membership', (_, invalid) => {
    expect(parseTennisRecordMatchPage(invalid, teamUrl).teamMembers).toEqual([])
  })

  it('does not promote schedule/opponent links or extra profile links outside the name column', () => {
    const mixed = html.replace('<td>St. Louis, MO</td>', '<td><a href="/adult/profile.aspx?playername=Unrelated">Unrelated</a></td>')
      + '<table><tr><th>Local Schedule</th></tr><tr><td><a href="/adult/profile.aspx?playername=Opponent">Opponent</a></td></tr></table>'
    expect(parseTennisRecordMatchPage(mixed, teamUrl).teamMembers.map(m => m.name)).toEqual(['Taylor Smith', "Jamie O'Neill"])
    expect(parseTennisRecordMatchPage(html, base + 'matchresults.aspx?year=2027&mid=1').teamMembers).toEqual([])
  })

  it('preserves a literal plus in the requested team identity', () => {
    const parsed = parseTennisRecordMatchPage(html.replace('<td>Example (F)</td>', '<td>Example+ (F)</td>'), teamUrl.replace('Example%20', 'Example%2B%20'))
    expect(parsed.teamMembers[0].teamName).toBe('Example+ (F)')
  })
})

describe('source roster season display', () => {
  const old = { player_name: 'Taylor Smith', season_year: 2026, league_name: '2026 Adult Fall', flight: 'Men 4.5 (F)' }
  const current = { ...old, season_year: 2027, league_name: '2027 Adult Fall' }
  const other = { ...current, player_name: 'Other Player', flight: 'Men 4.0 (F)' }
  const unknown = { player_name: 'Unknown Season', season_year: null, league_name: null, flight: null }
  it('scopes before deduplication and does not borrow unknown membership for a selected season', () => {
    expect(sourceRosterForScope([old, current, other, unknown], { season: '2027', league: current.league_name, flight: current.flight })).toEqual([current])
    expect(sourceRosterForScope([old, current, unknown], { season: '2026' })).toEqual([old])
    expect(sourceRosterForScope([old, current, unknown], { season: '2028' })).toEqual([])
    expect(sourceRosterForScope([unknown], { season: 'all' })).toEqual([unknown])
    expect(sourceRosterForScope([current], { season: '2027', league: 'Different League' })).toEqual([])
  })
  it('keeps directory counts distinct by championship year, including unknown legacy seasons', () => {
    expect(sourceRosterCountKey('example', 2027)).toBe(sourceRosterCountKey('example', '2027'))
    expect(sourceRosterCountKey('example', 2026)).not.toBe(sourceRosterCountKey('example', 2027))
    expect(sourceRosterCountKey('example', null)).not.toBe(sourceRosterCountKey('example', 2027))
    expect(sourceRosterCountKey('Meinert/The Other Guys (F)', 2027)).toBe(sourceRosterCountKey('meinert the other guys f', 2027))
  })
  it.each(['Meinert/The Other Guys (F)', 'Meinert-Rood (F)', 'Pottebaum/PennPals (F)', 'Équipe + Smith'])('matches ingestion identity keys for %s', team => {
    expect(sourceRosterTeamKey(team)).toBe(normalizeTennisIdentity(team))
  })
})
