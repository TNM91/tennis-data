import {describe,it,expect} from 'vitest'
import {emptyLeagueListFinder,filterLeagueParticipants,filterLeagueStandings,leagueParticipantsViewHtml,leagueStandingsViewHtml} from '../../mobile/src/league-list-finder'
import {competitionDetail,competitionPlayerDetail} from '../../tests/fixtures/competitions-data'
const filters=(query='',status='')=>({query,status})
describe('loaded league entry and standings search',()=>{
 it('normalizes Unicode width, case and whitespace while keeping punctuation literal',()=>{
  const rows=[{name:'Alex  [A].* Server',status:'active'},{name:'Alex Other Server',status:'active'}]
  expect(filterLeagueParticipants(rows,filters('  ＡＬＥＸ   [A].*  '),false).map(p=>p.name)).toEqual(['Alex  [A].* Server']);expect(filterLeagueParticipants(rows,filters('alex.*'),false)).toEqual([])
 })
 it('keeps public entries approved-only even when an organizer status is supplied',()=>{
  const d=competitionDetail();d.participants.push({name:'Waiting Aces',status:'pending'},{name:'Removed Aces',status:'removed'},{name:'Declined Aces',status:'rejected'})
  expect(filterLeagueParticipants(d.participants,filters('aces','pending'),false).map(p=>p.name)).toEqual(['Baseline Aces']);const rendered=leagueParticipantsViewHtml(d,filters(),false);expect(rendered).not.toContain('Waiting Aces');expect(rendered).not.toContain('Entry status')
 })
 it('filters organizer status exactly without matching status labels or mutating source order',()=>{
  const rows=[{name:'Active Aces',status:'pending'},{name:'Waiting Aces',status:'active'},{name:'Other',status:'pending'}],before=JSON.stringify(rows)
  expect(filterLeagueParticipants(rows,filters('aces','pending'),true)).toEqual([rows[0]]);expect(filterLeagueParticipants(rows,filters('pending'),true)).toEqual([]);expect(filterLeagueParticipants(rows,filters('','unknown'),true)).toEqual([]);expect(JSON.stringify(rows)).toBe(before)
 })
 it('retains source standings position and metrics without reranking, sorting or searching scores',()=>{
  const d=competitionDetail(),before=JSON.stringify(d.standings),rows=filterLeagueStandings(d.standings,filters('RALLY'))
  expect(rows).toEqual([{row:d.standings[1],position:2}]);expect(rows[0].row.points).toBe(7);expect(filterLeagueStandings(d.standings,filters('points'))).toEqual([]);expect(filterLeagueStandings(d.standings,filters('14'))).toEqual([]);expect(leagueStandingsViewHtml(d,filters('rally'))).toContain('<li value="2">');expect(JSON.stringify(d.standings)).toBe(before)
 })
 it('withholds incomplete and individual standings before presenting a search form',()=>{
  const d=competitionDetail();d.moreResults=true;expect(leagueStandingsViewHtml(d)).toContain('withheld');expect(leagueStandingsViewHtml(d)).not.toContain('data-league-list-finder');d.moreResults=false;d.standingsAvailable=false;expect(leagueStandingsViewHtml(d)).not.toContain('data-league-list-finder');expect(leagueStandingsViewHtml(competitionPlayerDetail())).toContain('individual league')
 })
 it('uses loaded sample counts and leaves absent search matches empty until cleared',()=>{
  const d=competitionDetail();d.moreParticipants=true;const rendered=leagueParticipantsViewHtml(d,filters('missing'),false)
  expect(rendered).toContain('Showing 0 of 2 loaded teams');expect(rendered).toContain('sample only');expect(rendered).toContain('first 100');expect(rendered).toContain('No teams fit these filters');expect(rendered).not.toContain('data-league-team-name')
 })
 it('uses full-source approval and uniqueness for history actions despite filtering',()=>{
  const d=competitionPlayerDetail();d.participants.push({...d.participants[0]},{name:'Alex Pending',status:'pending'});const rendered=leagueParticipantsViewHtml(d,filters('alex','active'),true)
  expect(rendered).not.toContain('data-league-player-name');expect(leagueParticipantsViewHtml(d,filters('Alex Pending','pending'),true)).not.toContain('data-league-player-name')
 })
 it('escapes query, selected entry names and source standings names in markup',()=>{
  const d=competitionDetail(),name='<Aces "North">';d.participants[0].name=name;d.standings[0].teamName=name
  for(const rendered of [leagueParticipantsViewHtml(d,filters(name)),leagueStandingsViewHtml(d,filters(name))]){expect(rendered).toContain('&lt;Aces &quot;North&quot;&gt;');expect(rendered).not.toContain('<Aces')}
 })
 it('gives each list and season independent filter state',()=>{const one=emptyLeagueListFinder(),two=emptyLeagueListFinder();one.participants.query='Alex';one.participants.status='pending';expect(one.standings).toEqual(filters());expect(two.participants).toEqual(filters());expect(two.standings).toEqual(filters())})
})
