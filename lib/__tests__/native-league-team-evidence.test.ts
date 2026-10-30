import {describe,it,expect} from 'vitest'
import {leagueTeamAvailable,leagueTeamDetailHtml,leagueTeamOpenHtml,leagueTeamRecords} from '../../mobile/src/league-team-evidence'
import {competitionDetail} from '../../tests/fixtures/competitions-data'
const selection={name:'Baseline Aces',source:'standings' as const}
describe('exact team league match evidence',()=>{
 it('opens only a unique current standings row or unique approved entry',()=>{
  const d=competitionDetail();expect(leagueTeamAvailable(d,selection)).toBe(true);expect(leagueTeamAvailable(d,{...selection,source:'participants'})).toBe(true)
  d.standings.push({...d.standings[0]});expect(leagueTeamOpenHtml(d,selection.name,'standings')).toBe('')
  d.participants.push({...d.participants[0]});expect(leagueTeamOpenHtml(d,selection.name,'participants')).toBe('')
  d.participants=d.participants.filter(p=>p.name!==selection.name);d.participants.push({name:selection.name,status:'pending'});expect(leagueTeamAvailable(d,{...selection,source:'participants'})).toBe(false)
 })
 it('matches complete exact team sides, not name prefixes, case variants or court player names',()=>{
  const d=competitionDetail();d.results.push({...d.results[0],id:'similar',a:'Baseline Aces B',b:'Other',courts:[{...d.results[0].courts[0],a:selection.name}]},{...d.results[0],id:'case',a:'BASELINE ACES',b:'Other',courts:[]})
  expect(leagueTeamRecords(d,selection.name).results.map(r=>r.id)).toEqual(['event-one']);expect(leagueTeamRecords(d,'Baseline').results).toEqual([])
 })
 it('uses saved standings values without recalculating wins from loaded results or courts',()=>{
  const d=competitionDetail();Object.assign(d.standings[0],{wins:9,losses:3,ties:2,lineWins:22,lineLosses:11,points:146.75});const rendered=leagueTeamDetailHtml(d,selection)
  expect(rendered).toContain('9–3–2');expect(rendered).toContain('22–11');expect(rendered).toContain('146.75');expect(rendered).toContain('Recorded team results · 1');expect(rendered).toContain('Court winner: Alex &amp; Jordan')
 })
 it('keeps cancellations and proposals visible and sorts both lists without mutating records',()=>{
  const d=competitionDetail();d.fixtures.reverse();d.fixtures.push({...d.fixtures[0],id:'proposal',status:'proposed',date:'2026-11-05'});d.results.push({...d.results[0],id:'newer',date:'2026-10-24'});const before=JSON.stringify(d)
  const records=leagueTeamRecords(d,selection.name);expect(records.fixtures.map(r=>r.id)).toEqual(['proposal','fixture-one','fixture-cancelled']);expect(records.results.map(r=>r.id)).toEqual(['newer','event-one']);expect(JSON.stringify(d)).toBe(before)
  const rendered=leagueTeamDetailHtml(d,selection);expect(rendered).toContain('Cancelled');expect(rendered).toContain('Proposed');expect(rendered).toContain('America/Chicago')
 })
 it('withholds summary metrics on partial results while an approved team can inspect the sample',()=>{
  const d=competitionDetail();d.moreFixtures=true;d.moreResults=true;d.standingsAvailable=false;d.standings=[]
  expect(leagueTeamDetailHtml(d,selection)).toContain('Team unavailable')
  const rendered=leagueTeamDetailHtml(d,{...selection,source:'participants'});expect(rendered).toContain('complete standings record is not available');expect(rendered).toContain('limited sample');expect(rendered).toContain('latest 100');expect(rendered).not.toContain('Saved team standings');expect(rendered).toContain('Recorded team results · 1')
 })
 it('revalidates the exact selected name after refresh instead of using the former row index',()=>{
  const d=competitionDetail();d.standings.reverse();expect(leagueTeamDetailHtml(d,selection)).toContain('1–0–0');d.standings=d.standings.filter(s=>s.teamName!==selection.name);const rendered=leagueTeamDetailHtml(d,selection);expect(rendered).toContain('Team unavailable');expect(rendered).not.toContain('Saved team standings');expect(rendered).not.toContain('6-4, 6-3')
 })
 it('never enables team evidence for individual leagues and escapes names in controls and evidence',()=>{
  const d=competitionDetail();d.league.format='individual';expect(leagueTeamAvailable(d,selection)).toBe(false);expect(leagueTeamOpenHtml(d,selection.name,'participants')).toBe('');d.league.format='team';const name='<Aces "A">';d.participants[0].name=name;d.fixtures[0].a=name
  const control=leagueTeamOpenHtml(d,name,'participants'),rendered=leagueTeamDetailHtml(d,{name,source:'participants'});expect(control).toContain('&lt;Aces &quot;A&quot;&gt;');expect(control).not.toContain('<Aces');expect(rendered).toContain('&lt;Aces &quot;A&quot;&gt;')
 })
})
