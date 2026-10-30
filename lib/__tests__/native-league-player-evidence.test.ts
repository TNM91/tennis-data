import {describe,it,expect} from 'vitest'
import {leaguePlayerAvailable,leaguePlayerDetailHtml,leaguePlayerOpenHtml,leaguePlayerRecords} from '../../mobile/src/league-player-evidence'
import {competitionPlayerDetail} from '../../tests/fixtures/competitions-data'
describe('individual league entry match evidence',()=>{
 it('requires a unique active entry in an individual league',()=>{
  const d=competitionPlayerDetail();expect(leaguePlayerAvailable(d,'Alex Server')).toBe(true);expect(leaguePlayerAvailable(d,'')).toBe(false);d.league.format='team';expect(leaguePlayerOpenHtml(d,'Alex Server')).toBe('');d.league.format='individual'
  for(const status of ['pending','removed','rejected']){d.participants[0].status=status;expect(leaguePlayerOpenHtml(d,'Alex Server')).toBe('')};d.participants[0].status='active';d.participants.push({...d.participants[0]});expect(leaguePlayerAvailable(d,'Alex Server')).toBe(false)
 })
 it('matches exact event-side names without prefixes, case folding or court-name joins',()=>{
  const d=competitionPlayerDetail();d.results.push({...d.results[0],id:'other-court',a:'Other',b:'Another',courts:[{label:'Line 1',a:'Alex Server',b:'Partner',score:'6-0',winner:'Side A'}]},{...d.results[0],id:'case-variant',a:'ALEX SERVER',b:'Another',courts:[]})
  expect(leaguePlayerRecords(d,'Alex Server').results.map(r=>r.id)).toEqual(['player-unrecorded','player-result']);expect(leaguePlayerRecords(d,'Alex').results).toEqual([])
 })
 it('shows stored score and unknown outcomes without inventing standings or rating metrics',()=>{
  const rendered=leaguePlayerDetailHtml(competitionPlayerDetail(),'Alex Server');expect(rendered).toContain('6-4, 6-3');expect(rendered).toContain('Winner not recorded');expect(rendered).toContain('Recorded winner: Alex Server');expect(rendered).toContain('Recorded player results · 2');expect(rendered).not.toContain('Team winner');expect(rendered).not.toContain('Saved team standings');expect(rendered).not.toContain('Win rate');expect(rendered).not.toContain('Points')
 })
 it('sorts calendar evidence without mutating the loaded league data',()=>{
  const d=competitionPlayerDetail();d.fixtures.reverse();const before=JSON.stringify(d),r=leaguePlayerRecords(d,'Alex Server');expect(r.fixtures.map(f=>f.id)).toEqual(['fixture-one','fixture-cancelled']);expect(r.results.map(f=>f.id)).toEqual(['player-unrecorded','player-result']);expect(JSON.stringify(d)).toBe(before)
 })
 it('shows partial-sample limits and counts only the loaded matching records',()=>{
  const d=competitionPlayerDetail();d.moreFixtures=true;d.moreResults=true;const rendered=leaguePlayerDetailHtml(d,'Alex Server');expect(rendered).toContain('latest 100');expect(rendered).toContain('limited sample');expect(rendered).toContain('Dates shown');expect(rendered).toContain('Results shown');expect(rendered).not.toContain('2+')
 })
 it('revalidates exact approved names after reordering and removal',()=>{
  const d=competitionPlayerDetail();d.participants.reverse();expect(leaguePlayerDetailHtml(d,'Alex Server')).toContain('Recorded player results · 2');d.participants=d.participants.filter(p=>p.name!=='Alex Server');const rendered=leaguePlayerDetailHtml(d,'Alex Server');expect(rendered).toContain('Player entry unavailable');expect(rendered).not.toContain('6-4, 6-3')
 })
 it('escapes entry names in attributes and headings',()=>{
  const d=competitionPlayerDetail(),name='<Alex "Server">';d.participants[0].name=name;const control=leaguePlayerOpenHtml(d,name),rendered=leaguePlayerDetailHtml(d,name);expect(control).toContain('&lt;Alex &quot;Server&quot;&gt;');expect(control).not.toContain('<Alex');expect(rendered).toContain('&lt;Alex &quot;Server&quot;&gt;')
 })
 it('does not split paired entrant labels into individual player records',()=>{
  const d=competitionPlayerDetail();d.participants[0].name='Alex & Jordan';d.results[0].a='Alex & Jordan';expect(leaguePlayerAvailable(d,'Alex')).toBe(false);expect(leaguePlayerRecords(d,'Alex & Jordan').results).toHaveLength(1);expect(leaguePlayerRecords(d,'Alex').results).toHaveLength(0)
 })
})
