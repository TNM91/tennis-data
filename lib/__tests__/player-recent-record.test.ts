import {describe,it,expect} from 'vitest'
import {playerRecentRecord} from '../player-recent-record'
import {recentStatsHtml,filteredMatches,resultsHtml} from '../../mobile/src/results-view'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const entries=(results:string[])=>results.map((result,i)=>({result,date:`2026-10-${String(27-i).padStart(2,'0')}`}))
const match=(type:string,winner:string|null):RecentMatchRow=>({id:type,match_date:'2026-10-27',match_type:type,league_name:'Synthetic league',score:'6-4 6-4',winner_side:winner,match_players:[{player_id:'me',side:'A'}]})
describe('shared My Lab recent record',()=>{
 it('matches website decided-result streaks and excludes pending outcomes',()=>{
  expect(playerRecentRecord(entries(['W','pending','W','L','W','W','W']))).toEqual({wins:5,losses:1,pending:1,winRate:83,currentWinStreak:2,bestWinStreak:3})
  expect(playerRecentRecord(entries(['L','W','W']))).toMatchObject({currentWinStreak:0,bestWinStreak:2})
 })
 it('handles empty, pending-only, all-win and all-loss records without a fabricated percentage',()=>{
  expect(playerRecentRecord([])).toMatchObject({winRate:null,bestWinStreak:0,currentWinStreak:0})
  expect(playerRecentRecord(entries(['pending']))).toMatchObject({winRate:null,pending:1})
  expect(playerRecentRecord(entries(['W','W']))).toMatchObject({winRate:100,currentWinStreak:2})
  expect(playerRecentRecord(entries(['L','L']))).toMatchObject({winRate:0,bestWinStreak:0})
 })
 it('keeps equal-date ordering consistent across chronological day boundaries',()=>{
  expect(playerRecentRecord([{date:'2026-10-27',result:'W'},{date:'2026-10-27',result:'L'},{date:'2026-10-26',result:'L'},{date:'2026-10-26',result:'W'}])).toMatchObject({currentWinStreak:1,bestWinStreak:1})
 })
 it('does not mutate its input while ordering best-streak history',()=>{
  const source=entries(['W','L','W']);const copy=structuredClone(source);playerRecentRecord(source);expect(source).toEqual(copy)
 })
 it('uses website format matching and keeps the comparison sample explicit',()=>{
  const rows=[match('Mixed Doubles','A'),match('Singles','B'),match('Doubles',null)]
  expect(filteredMatches(rows,'Doubles')).toHaveLength(2)
  const output=recentStatsHtml(rows,'me','Singles')
  expect(output).toContain('Singles · latest 3 connected results')
  expect(output).toContain('value="100" aria-label="Doubles')
  expect(output).toContain('0 wins · 1 loss · 0 pending')
  expect(output).toContain('1 win · 0 losses · 1 pending')
  expect(output).toContain('not your full-history record')
 })
 it('shows absent formats without meters or invented wins and limits new panels to My Lab',()=>{
  expect(recentStatsHtml([],'me','All')).not.toContain('<meter')
  expect(recentStatsHtml([],'me','All')).toContain('No singles results in this sample')
  const rows=[match('Doubles','A')]
  expect(resultsHtml(rows,'me','All')).not.toContain('lab-recent-stats')
  expect(resultsHtml(rows,'me','All','your',true)).toContain('lab-recent-stats')
 })
})
