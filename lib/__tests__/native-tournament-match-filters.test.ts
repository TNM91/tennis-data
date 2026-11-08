import {describe,it,expect} from 'vitest'
import {emptyTournamentMatchFilters,filterTournamentMatches,tournamentMatchFiltersHtml,tournamentViewMatches} from '../../mobile/src/tournament-match-filters'
import {tournamentDetailHtml} from '../../mobile/src/tournaments-view'
import {tournamentSnapshot} from '../../tests/fixtures/native-tournaments'
import type {TournamentMatch} from '../native-tournaments-contract'
const detail=()=>tournamentSnapshot('event-one','division-one').detail!
const filters=(query='',day='',court='',round='')=>({query,day,court,round})
describe('published tournament match finder',()=>{
 it('groups numbered court labels while preserving named courts and their schedules',()=>{
  const d=detail()
  d.matches[0].court='Court 2'
  d.matches[1].court='2'
  d.matches.push({...d.matches[1],id:'stadium',court:'Stadium Court'})
  expect(filterTournamentMatches(d.matches,'schedule',filters('','','2')).map(m=>m.id)).toEqual(['r1-m2','r2-m1'])
  const choices=tournamentMatchFiltersHtml(d.matches,'schedule',filters('','','2'))
  expect(choices.match(/>Court 2<\/option>/g)).toHaveLength(1)
  expect(choices).toContain('<option value="2" selected>Court 2</option>')
  expect(choices).toContain('>Stadium Court</option>')
  const markup=tournamentDetailHtml(d,'schedule',filters('','','Court 2'))
  expect(markup).not.toContain('Court Court 2')
  expect(markup.indexOf('6:00 PM')).toBeLessThan(markup.indexOf('Alex Ace'))
 })
 it('finds either side literally with normalized case, spacing and full-width text',()=>{const rows=detail().matches;expect(filterTournamentMatches(rows,'draw',filters('  JORDAN   SERVE  ')).map(m=>m.id)).toEqual(['r2-m1']);expect(filterTournamentMatches(rows,'draw',filters('Ａｌｅｘ'))).toHaveLength(2);expect(filterTournamentMatches(rows,'draw',filters('.*'))).toHaveLength(0)})
 it('combines name, exact day and exact court only for schedule',()=>{const rows=detail().matches;expect(filterTournamentMatches(rows,'schedule',filters('Alex','2026-11-14','2')).map(m=>m.id)).toEqual(['r1-m2']);expect(filterTournamentMatches(rows,'schedule',filters('Alex','2026-11-14','1'))).toEqual([]);expect(filterTournamentMatches(rows,'draw',filters('Alex','2026-11-14','1'))).toHaveLength(2);expect(filterTournamentMatches(rows,'results',filters('Alex','2026-11-15','1'))).toHaveLength(1)})
 it('filters exact published draw labels even when two pools share a round number',()=>{
  const d=detail(),[a,b]=d.matches
  a.label='Group A · Round 1'
  Object.assign(b,{round:1,label:'Group B · Round 1'})
  const criteria=filters('Alex','','',b.label)
  expect(filterTournamentMatches(d.matches,'draw',criteria)).toEqual([b])
  expect(filterTournamentMatches(d.matches,'draw',filters('Casey','','',b.label))).toEqual([])
  expect(filterTournamentMatches(d.matches,'schedule',criteria)).toEqual([a,b])
  expect(filterTournamentMatches(d.matches,'results',criteria)).toEqual([a])
  expect(tournamentMatchFiltersHtml([a],'draw',criteria)).toContain('Group B · Round 1 — no longer published')
 })
 it('groups published rounds in source order and distinguishes a missing court from a result',()=>{
  const d=detail(),[a,b]=d.matches
  Object.assign(b,{label:'<Final>',court:'',date:'',time:''})
  d.matches.splice(1,0,{...a,id:'another',a:'Avery Serve',b:'Sam Return',winner:'',score:''})
  const markup=tournamentDetailHtml(d,'draw')
  expect(markup.match(/class="competition-match-group"/g)).toHaveLength(2)
  expect(markup).toContain('<h4>Round 1</h4><small>2 matches</small>')
  expect(markup).toContain('<h4>&lt;Final&gt;</h4><small>1 match</small>')
  expect(markup.indexOf('Avery Serve')).toBeLessThan(markup.indexOf('<h4>&lt;Final&gt;'))
  expect(markup).toContain('Court not published')
  expect(markup.match(/data-recorded-winner/g)).toHaveLength(1)
  expect(tournamentDetailHtml(d,'draw',filters('','','','<Final>'))).not.toContain('Avery Serve')
 })
 it('groups assignments by day and sorts known times and courts before partial assignments',()=>{
  const d=detail(),[first,next]=d.matches
  const stadium={...first,id:'stadium',time:'08:00',court:'Stadium',a:'Stadium player',winner:'',score:''}
  const court12={...first,id:'court12',court:'12',a:'Court twelve player',winner:'',score:''}
  const dayOnly={...first,id:'day-only',time:'',court:'',a:'Day only player',winner:'',score:''}
  const courtOnly={...next,id:'court-only',date:'',time:'',court:'5',a:'Court only player'}
  const invalidDay={...next,id:'legacy',date:'2026-02-30',a:'Legacy assignment'}
  d.matches=[courtOnly,next,court12,first,invalidDay,dayOnly,stadium]
  expect(tournamentViewMatches(d.matches,'schedule').map(match=>match.id)).toEqual(['stadium','r1-m2','court12','day-only','r2-m1','legacy','court-only'])
  const markup=tournamentDetailHtml(d,'schedule')
  expect(markup.match(/class="competition-match-group"/g)).toHaveLength(3)
  expect(markup).toContain('<h4>Saturday, November 14, 2026</h4><small>4 matches</small>')
  expect(markup).toContain('<h4>Date to be confirmed</h4><small>2 matches</small>')
  expect(markup).toContain('Time to be confirmed')
  expect(markup).toContain('Court not published')
  expect(markup).not.toContain('fixture-schedule-date')
  expect(markup).not.toContain('value="2026-02-30"')
 })
 it('keeps unpublished court assignments out of schedule and unrecorded matches out of results without mutating the source',()=>{const rows=detail().matches;rows.push({...rows[1],id:'unscheduled',date:'',time:'',court:''});const original=structuredClone(rows);expect(tournamentViewMatches(rows,'schedule').map(m=>m.id)).toEqual(['r1-m2','r2-m1']);expect(tournamentViewMatches(rows,'results').map(m=>m.id)).toEqual(['r1-m2']);expect(rows).toEqual(original)})
 it('matches either partner in doubles names and treats courts as exact values',()=>{const rows:TournamentMatch[]=[{...detail().matches[0],a:'Alex Ace / Sam Return',court:'12'},{...detail().matches[1],court:'2'}];expect(filterTournamentMatches(rows,'schedule',filters('Sam Return'))).toHaveLength(1);expect(filterTournamentMatches(rows,'schedule',filters('','','2')).map(m=>m.id)).toEqual(['r2-m1'])})
 it('shows a filtered count and recoverable empty state without changing scoreboard totals',()=>{const d=detail(),markup=tournamentDetailHtml(d,'schedule',filters('Nobody'));expect(markup).toContain('0 of 2 matches');expect(markup).toContain('No matches fit these filters');expect(markup).toContain('Clear filters');expect(tournamentDetailHtml(d,'home',filters('Nobody'))).toBe(tournamentDetailHtml(d,'home'))})
 it('escapes player input and court labels, sorts court choices naturally, and preserves removed selections',()=>{const rows=detail().matches;rows.push({...rows[0],id:'extra',court:'12'});const markup=tournamentMatchFiltersHtml(rows,'schedule',filters('"/><img src=x>','2026-11-30','<court>'));expect(markup).toContain('&lt;img');expect(markup).not.toContain('<img');expect(markup).toContain('&lt;court&gt;');expect(markup).toContain('no longer scheduled');expect(markup.indexOf('Court 2')).toBeLessThan(markup.indexOf('Court 12'))})
 it('does not offer filters or partial counts for withheld draws',()=>{const d=detail();d.drawNotice='No partial standings are shown.';d.matches=[];for(const view of ['draw','schedule','results'] as const){expect(tournamentDetailHtml(d,view,filters('Alex'))).not.toContain('<form');expect(tournamentDetailHtml(d,view)).not.toContain('of 0 matches')}})
 it('clears all criteria with a fresh empty filter value',()=>{const first=emptyTournamentMatchFilters();first.query='Alex';expect(emptyTournamentMatchFilters()).toEqual(filters());expect(filterTournamentMatches(detail().matches,'draw',emptyTournamentMatchFilters())).toHaveLength(2)})
})
