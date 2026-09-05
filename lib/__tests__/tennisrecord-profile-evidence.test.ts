import { describe, expect, it } from 'vitest'
import { parseTennisRecordMatchPage, tennisRecordProfileEvidence } from '../tennisrecord/parser'

const url = 'https://www.tennisrecord.com/adult/profile.aspx?playername=Marcia%20O%27Donoghue'
const link = `<a href="/adult/profile.aspx?playername=Marcia O'Donoghue">Marcia O'Donoghue</a>`
describe('verified profile-owner evidence', () => {
  it.each(['No Player Found', 'No <b>Player</b> Found', 'Player not found', 'Profile not found'])('rejects %s even with a named heading and unrelated discoveries', message => {
    const parsed = parseTennisRecordMatchPage(`<h1>Marcia O'Donoghue</h1><div>${message}</div><a href="/adult/matchresults.aspx?year=2026&mid=1">Match</a>`, url)
    expect(parsed.reviewReason).toContain('No Player Found')
    for (const key of ['players', 'teams', 'teamMembers', 'leagues', 'matches', 'discoveredUrls'] as const) expect(parsed[key]).toEqual([])
  })
  it.each(['', '<title>TennisRecord.com</title><div>Player Profile</div>', `<script><h1>Marcia O'Donoghue</h1></script>`, `<!-- <h1>Marcia O'Donoghue</h1> -->`, `<div>Player Profile</div><div>Recent Team</div>${link}`])('does not manufacture a profile from a URL or unrelated markup', html => {
    expect(parseTennisRecordMatchPage(html, url)).toMatchObject({ players: [], reviewReason: expect.stringContaining('could not be verified') })
  })
  it('accepts a sparse legacy profile with a matching visible named heading', () => {
    const parsed = parseTennisRecordMatchPage(`<h1>Marcia O&#39;Donoghue</h1>`, url)
    expect(parsed.reviewReason).toBeUndefined()
    expect(parsed.players).toHaveLength(1)
    expect(parsed.players[0]).toMatchObject({ name: "Marcia O'Donoghue", ntrpLabel: '', city: '' })
  })
  it('accepts a current sparse self-linked owner, without requiring ratings or location', () => {
    expect(parseTennisRecordMatchPage(`<table><tr><td>Player Profile</td></tr></table>${link}`, url).players[0].name).toBe("Marcia O'Donoghue")
  })
  it('keeps stated rating evidence for a verified current profile', () => {
    const parsed = parseTennisRecordMatchPage(`<div>Player Profile</div>${link} (St. Louis, MO)<span>4.0 C</span><br>12/31/2025<div>Estimated Dynamic Rating 4.1123</div>`, url)
    expect(parsed.players[0]).toMatchObject({ name: "Marcia O'Donoghue", city: 'St. Louis', state: 'MO', ntrpLabel: '4.0 C' })
  })
  it('does not silently repair an old truncated source key or accept another same-name identity', () => {
    expect(tennisRecordProfileEvidence(`<div>Player Profile</div>${link}`, url.replace('%27Donoghue', ''))).toHaveProperty('reviewReason')
    expect(tennisRecordProfileEvidence(`<div>Player Profile</div>${link}`, url + '&s=2')).toHaveProperty('reviewReason')
    expect(tennisRecordProfileEvidence('<h1>Someone Else</h1>', url)).toHaveProperty('reviewReason')
  })
  it('ignores missing-profile text inside scripts and does not apply profile guards to other page kinds', () => {
    expect(tennisRecordProfileEvidence(`<script>No Player Found</script><h1>Marcia O'Donoghue</h1>`, url).reviewReason).toBeUndefined()
    expect(tennisRecordProfileEvidence('No Player Found', 'https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Marcia&year=2026')).toEqual({})
  })
})
