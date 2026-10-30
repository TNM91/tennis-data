import {describe,it,expect} from 'vitest'
import {emptyLeagueMatchFilters,filterLeagueFixtures,filterLeagueResults,leagueMatchViewHtml} from '../../mobile/src/league-match-finder'
import {competitionDetail} from '../../tests/fixtures/competitions-data'

describe('league match discovery keeps team and court evidence separate',()=>{
 it('combines literal team search, exact calendar day and recorded schedule status',()=>{
  const d=competitionDetail();d.fixtures.push({...d.fixtures[0],id:'other',a:'Rally [Crew]',status:'proposed',date:'2026-11-08'})
  const filters={query:'  ＢＡＳＥＬＩＮＥ   aces ',day:'2026-11-07',status:'cancelled'}
  expect(filterLeagueFixtures(d.fixtures,filters).map(r=>r.id)).toEqual(['fixture-cancelled'])
  expect(filterLeagueFixtures(d.fixtures,{...emptyLeagueMatchFilters(),query:'[Crew]'}).map(r=>r.id)).toEqual(['other'])
  expect(filterLeagueFixtures(d.fixtures,{...filters,status:'confirmed'})).toEqual([])
 })
 it('searches recorded court players without treating the team winner as a player win',()=>{
  const d=competitionDetail();d.results.push({...d.results[0],id:'other',a:'Other team',b:'Another team',courts:[]})
  const filters={query:'jordan',day:'',status:''},rows=filterLeagueResults(d.results,filters)
  expect(rows.map(r=>r.id)).toEqual(['event-one']);expect(rows[0].winner).toBe('Baseline Aces')
  const rendered=leagueMatchViewHtml(d,'results',filters)
  expect(rendered).toContain('Team winner: Baseline Aces');expect(rendered).toContain('Court winner: Alex &amp; Jordan');expect(rendered).toContain('<details open>');expect(rendered).toContain('1 of 2 loaded team results')
  expect(rendered).not.toContain('14 points');expect(d.standings[0].wins).toBe(1)
 })
 it('keeps schedule and result filters independent between visits',()=>{
  const d=competitionDetail();const schedule={query:'Baseline',day:'2026-11-07',status:'cancelled'},results={query:'Jordan',day:'2026-10-23',status:''}
  expect(filterLeagueFixtures(d.fixtures,schedule)).toHaveLength(1);expect(filterLeagueResults(d.results,results)).toHaveLength(1)
  expect(filterLeagueResults(d.results,{...results,day:'2026-11-07'})).toHaveLength(0);expect(schedule.day).toBe('2026-11-07')
 })
 it('does not search scores, winner text, facilities or an unrelated court when filtering schedule',()=>{
  const d=competitionDetail();expect(filterLeagueResults(d.results,{query:'6-4',day:'',status:''})).toEqual([])
  expect(filterLeagueFixtures(d.fixtures,{query:'Jordan',day:'',status:''})).toEqual([])
  expect(filterLeagueFixtures(d.fixtures,{query:'Northside',day:'',status:''})).toEqual([])
 })
 it('sorts calendar dates without changing source arrays or inferring a fixture-result join',()=>{
  const d=competitionDetail();d.results.unshift({...d.results[0],id:'older',date:'2026-10-01'});d.fixtures.reverse()
  const before=JSON.stringify(d)
  expect(filterLeagueFixtures(d.fixtures,emptyLeagueMatchFilters()).map(r=>r.id)).toEqual(['fixture-one','fixture-cancelled'])
  expect(filterLeagueResults(d.results,emptyLeagueMatchFilters()).map(r=>r.id)).toEqual(['event-one','older'])
  expect(JSON.stringify(d)).toBe(before)
 })
 it('retains a removed date as unavailable and returns zero matches until cleared',()=>{
  const d=competitionDetail(),filters={query:'',day:'2026-09-01',status:''}
  expect(filterLeagueFixtures(d.fixtures,filters)).toEqual([])
  const rendered=leagueMatchViewHtml(d,'fixtures',filters)
  expect(rendered).toContain('value="2026-09-01" selected');expect(rendered).toContain('no longer loaded');expect(rendered).toContain('No matches fit these filters');expect(rendered).toContain('Clear filters')
 })
 it('discloses bounded result and court samples without manufacturing full standings',()=>{
  const d=competitionDetail();d.moreResults=true;d.standingsAvailable=false;d.standings=[]
  const rendered=leagueMatchViewHtml(d,'results',{query:'missing',day:'',status:''})
  expect(rendered).toContain('Limited result/court sample');expect(rendered).toContain('Filters search this sample only');expect(rendered).toContain('0 of 1 loaded team results');expect(rendered).not.toContain('points')
 })
 it('keeps missing individual winners unrecorded without adding team claims',()=>{
  const d=competitionDetail();d.league.format='individual';d.results=[{id:'single',date:'2026-10-23',a:'Alex',b:'Casey',winner:'',score:'6-4',courts:[]}]
  const rendered=leagueMatchViewHtml(d,'results')
  expect(rendered).toContain('Winner not recorded');expect(rendered).toContain('1 of 1 loaded player results');expect(rendered).not.toContain('Team winner');expect(rendered).not.toContain('individual player win')
 })
 it('escapes search controls and saved names, including literal HTML-like player queries',()=>{
  const d=competitionDetail();d.results[0].courts[0].a='<Alex>';d.results[0].a='<Aces>'
  const rendered=leagueMatchViewHtml(d,'results',{query:'<Alex>',day:'',status:''})
  expect(rendered).toContain('&lt;Alex&gt;');expect(rendered).toContain('&lt;Aces&gt;');expect(rendered).not.toContain('<Alex>');expect(rendered).not.toContain('<Aces>')
 })
})
