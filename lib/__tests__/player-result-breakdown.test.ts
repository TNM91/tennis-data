import {describe,it,expect} from 'vitest'
import {playerResultBreakdown} from '../player-result-breakdown'
import {labResultBreakdownHtml} from '../../mobile/src/lab-result-breakdown'
import {resultsHtml} from '../../mobile/src/results-view'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const entry=(leagueName:string|null,result:string,date:string|null='2026-01-01')=>({leagueName,result,date})
const match:RecentMatchRow={id:'one',match_date:'2026-01-01',league_name:'City League',match_type:'Doubles',score:'6-4',winner_side:'A',match_players:[{player_id:'me',side:'A'}]}
describe('shared My Lab result breakdown',()=>{
 it('groups decided records and ranks by rate then wins and volume',()=>{
  const result=playerResultBreakdown([entry('A','W'),entry('A','L'),entry('B','W'),entry('C','W'),entry('C','W'),entry('D','L'),entry('Pending league','pending')])
  expect(result.leagues.map(row=>row.label)).toEqual(['C','B','A','D'])
  expect(result.leagues[2]).toEqual({label:'A',wins:1,losses:1,total:2,winRate:50})
  expect(result.seasons).toEqual([{label:'2026',wins:4,losses:2,total:6,winRate:67}])
 })
 it('uses calendar years independently of local device timezone',()=>{
  expect(playerResultBreakdown([entry('A','W','2026-01-01'),entry('A','L','2025-12-31')]).seasons.map(row=>row.label)).toEqual(['2026','2025'])
 })
 it('retains unknown years/leagues without inventing dates and does not mutate input',()=>{
  const source=[entry(null,'W',null),entry('','L','bad-date')],copy=structuredClone(source)
  expect(playerResultBreakdown(source)).toEqual({seasons:[{label:'Connected',wins:1,losses:1,total:2,winRate:50}],leagues:[{label:'Connected matches',wins:1,losses:1,total:2,winRate:50}]})
  expect(source).toEqual(copy)
  expect(playerResultBreakdown([entry('A','pending')])).toEqual({seasons:[],leagues:[]})
 })
 it('escapes league names and explains sample/ranking limits',()=>{
  const output=labResultBreakdownHtml([{...match,league_name:'<img onerror=x>'}],'me','leagues',10)
  expect(output).toContain('&lt;img onerror=x&gt;')
  expect(output).not.toContain('<img')
  expect(output).toContain('latest 10 connected results')
  expect(output).toContain('not full league or season records')
  expect(output).toContain('Small samples can rank first')
 })
 it('keeps unknown years, pending-only records and no-format views honest',()=>{
  expect(labResultBreakdownHtml([{...match,match_date:null}],'me','seasons',1)).toContain('Year unavailable')
  const pending=labResultBreakdownHtml([{...match,winner_side:null}],'me','leagues',1)
  expect(pending).not.toContain('<meter')
  expect(pending).toContain('No decided results')
  expect(resultsHtml([match],'me','Singles','your',true)).toContain('No decided results')
  expect(resultsHtml([match],'me','All')).not.toContain('lab-result-breakdown')
  expect(resultsHtml([match],'me','All','your',true,'seasons')).toContain('data-result-breakdown="seasons" aria-pressed="true"')
 })
})
