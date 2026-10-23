import { describe, expect, it } from 'vitest'
import { filteredMatches, recentForm, resultsHtml } from '../../mobile/src/results-view'
import type { RecentMatchRow } from '../../mobile/src/recent-results'
const row = (id: string, type: string | null, winner: string | null): RecentMatchRow => ({id, match_type:type, winner_side:winner, match_date:'2026-10-23', league_name:'League', score:'6-4', match_players:[{player_id:'me',side:'B'}]})
const rows = [row('singles','Singles','B'),row('doubles',' doubles ','A'),row('pending','Doubles',null),row('unknown',null,'B')]
describe('mobile recent form', () => {
  it('counts the linked player’s outcomes without treating pending as a loss', () => {
    expect(recentForm(rows,'me')).toEqual({wins:2,losses:1,pending:1})
    expect(recentForm(rows,'other')).toEqual({wins:0,losses:0,pending:4})
  })
  it('filters match types while retaining unknown types in All and source order', () => {
    expect(filteredMatches(rows,'All')).toEqual(rows)
    expect(filteredMatches(rows,'Singles').map(r=>r.id)).toEqual(['singles'])
    expect(filteredMatches(rows,'Doubles').map(r=>r.id)).toEqual(['doubles','pending'])
    expect(recentForm(filteredMatches(rows,'Doubles'),'me')).toEqual({wins:0,losses:1,pending:1})
  })
  it('labels the limited result sample and exposes the selected filter accessibly', () => {
    const html = resultsHtml(rows,'me','Doubles')
    expect(html).toContain('2 doubles matches in your latest 4 connected results.')
    expect(html).toContain('data-match-filter="Doubles" aria-pressed="true"')
    expect(html).not.toContain('career')
    expect(html).toContain('Result pending')
  })
  it('offers a way out of an empty filtered view and escapes hosted data', () => {
    expect(resultsHtml([rows[0]],'me','Doubles')).toContain('Try All.')
    expect(resultsHtml([{...rows[0],league_name:'<img src=x onerror=alert(1)>'}],'me','All')).not.toContain('<img')
  })
})
