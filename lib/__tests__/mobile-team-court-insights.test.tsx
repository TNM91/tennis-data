import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {filterTeamCourts,teamCourtGroups,type CourtFilters} from '../../mobile/src/team-court-insights'
import {TeamCourtSampleView} from '../../mobile/src/team-court-records-view'
import type {TeamCourtRecord} from '../../mobile/src/team-court-records-data'
const a={id:'a',name:'Same Name'},b={id:'b',name:'Same Name'},c={id:'c',name:'Casey'}
const rows:TeamCourtRecord[]=[{id:'one',date:'2026-10-20',format:'doubles',opponent:'Rallies',score:'6-4 6-4',result:'W',players:[a,b]},{id:'two',date:'2026-10-10',format:'singles',opponent:'Westside',score:'4-6 4-6',result:'L',players:[a]},{id:'three',date:'2025-05-20',format:'doubles',opponent:'Rallies',score:'6-2 6-2',result:'W',players:[a,c]},{id:'four',date:'2025-05-10',format:'doubles',opponent:'Westside',score:'4-6 4-6',result:'L',players:null}]
const all:CourtFilters={format:'all',year:'all',result:'all',query:''}
describe('filtered team court insights',()=>{
 it('combines exact year, format, result and local name/opponent/score searches',()=>{
  expect(filterTeamCourts(rows,{...all,year:'2026',format:'doubles',result:'W',query:'same'}).map(r=>r.id)).toEqual(['one'])
  expect(filterTeamCourts(rows,{...all,query:' westSIDE '}).map(r=>r.id)).toEqual(['two','four'])
  expect(filterTeamCourts(rows,{...all,query:'6-2'}).map(r=>r.id)).toEqual(['three'])
  expect(filterTeamCourts(rows,{...all,query:'Casey'}).map(r=>r.id)).toEqual(['three'])
  expect(filterTeamCourts(rows,{...all,year:'202'})).toEqual([])
 })
 it('keeps same-name identities separate, counts each player once per court and excludes unconfirmed identities',()=>{
  expect(teamCourtGroups(rows,'players')).toEqual([{key:'a',label:'Same Name',played:3,wins:2,losses:1,singles:1,doubles:2},{key:'b',label:'Same Name',played:1,wins:1,losses:0,singles:0,doubles:1},{key:'c',label:'Casey',played:1,wins:1,losses:0,singles:0,doubles:1}])
  expect(teamCourtGroups([rows[3]],'players')).toEqual([])
 })
 it('counts every court once per opposing team, including courts with missing player identities',()=>{
  expect(teamCourtGroups(rows,'opponents')).toEqual([{key:'Rallies',label:'Rallies',played:2,wins:2,losses:0,singles:0,doubles:2},{key:'Westside',label:'Westside',played:2,wins:0,losses:2,singles:1,doubles:1}])
 })
 it('uses only the filtered records for every breakdown without mutating source order or names',()=>{
  const snapshot=JSON.stringify(rows),filtered=filterTeamCourts(rows,{...all,result:'L',year:'2026'})
  expect(teamCourtGroups(filtered,'players')).toEqual([{key:'a',label:'Same Name',played:1,wins:0,losses:1,singles:1,doubles:0}])
  expect(teamCourtGroups(filtered,'opponents')[0]).toMatchObject({key:'Westside',played:1,wins:0,losses:1});expect(JSON.stringify(rows)).toBe(snapshot)
 })
 it('shows bounded chart coverage but keeps all player records in the disclosure and escapes source names',()=>{
  const records=Array.from({length:8},(_,i)=>({...rows[0],format:'singles' as const,id:'court'+i,players:[{id:'player'+i,name:i===7?'<Last Player>':'Player '+i}]}))
  const markup=renderToStaticMarkup(<TeamCourtSampleView sample={{records,parentCount:2,excluded:0,sampled:false}}/>)
  expect(markup).toContain('Showing 6 of 8 players');expect(markup).toContain('&lt;Last Player&gt;');expect(markup).not.toContain('<Last Player>');expect(markup).toContain('All player court records');expect(markup).toContain('not a team-tie record');expect(markup).not.toContain('style=')
 })
 it('does not invent zero-percent player records or meters for an empty sample',()=>{
  const markup=renderToStaticMarkup(<TeamCourtSampleView sample={{records:[],parentCount:0,excluded:0,sampled:false}}/>);expect(markup).toContain('No confirmed player records');expect(markup).not.toContain('<meter');expect(teamCourtGroups([],'opponents')).toEqual([])
 })
})
