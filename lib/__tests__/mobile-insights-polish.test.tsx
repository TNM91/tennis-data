import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {journeyWindowSummary} from '../../mobile/src/player-journey-data'
import {RecordScoreboard} from '../../mobile/src/record-graphics'
import {labBreakdownMatches,labResultBreakdownHtml} from '../../mobile/src/lab-result-breakdown'
import RatingJourneyExplorer from '../../app/components/rating-journey-explorer'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const row=(id:string,date:string|null,league:string|null,winner:string|null='B'):RecentMatchRow=>({id,match_date:date,league_name:league,match_type:'doubles',winner_side:winner,score:'6-4 6-3',match_players:[{player_id:'owner',side:'B'}]})
describe('native recorded-result insights',()=>{
 it('computes window movement from endpoints, withholding movement with fewer than two ratings',()=>{
  expect(journeyWindowSummary([])).toEqual({first:null,latest:null,change:null,count:0})
  expect(journeyWindowSummary([{rating:4.2}]).change).toBeNull()
  expect(journeyWindowSummary([{rating:4.1},{rating:4.8},{rating:4.42}]).change).toBeCloseTo(.32)
  expect(journeyWindowSummary([{rating:4.2},{rating:4.2}]).change).toBe(0)
  expect(journeyWindowSummary([{rating:4.5},{rating:4.2}]).change).toBeCloseTo(-.3)
 })
 it('distinguishes no coverage, all losses and all wins with the exact match or court denominator',()=>{
  const empty=renderToStaticMarkup(<RecordScoreboard wins={0} losses={0} label="Shown courts" unit="courts"/>);expect(empty).toContain('no decided results');expect(empty).not.toContain('0% wins')
  const loss=renderToStaticMarkup(<RecordScoreboard wins={0} losses={3} label="Shown courts" unit="courts"/>);expect(loss).toContain('0% wins');expect(loss).toContain('3 decided courts');expect(loss).not.toContain('stat-donut-fill')
  const win=renderToStaticMarkup(<RecordScoreboard wins={1} losses={0} label="Match record"/>);expect(win).toContain('100% wins');expect(win).toContain('1 decided match');expect(win).toContain('stroke-dasharray="100 100"')
  for(const wins of [-1,NaN,Infinity,1.5]){const invalid=renderToStaticMarkup(<RecordScoreboard wins={wins} losses={1} label="<record>"/>);expect(invalid).toContain('Record unavailable');expect(invalid).not.toMatch(/NaN|Infinity|<record>|style=/)}
 })
 it('ties decided league/year scorecards to original filtered-row indexes including unknown dates',()=>{
  const rows=[row('pending','2026-10-20','City',null),row('old','2025-12-31','City'),row('new','2026-01-01','Other','A'),row('unknown',null,null)]
  expect(labBreakdownMatches(rows,'owner','leagues','City').map(x=>x.index)).toEqual([1])
  expect(labBreakdownMatches(rows,'owner','seasons','2026').map(x=>x.row.id)).toEqual(['new'])
  expect(labBreakdownMatches(rows,'owner','seasons','Connected').map(x=>x.index)).toEqual([3])
  const markup=labResultBreakdownHtml(rows,'owner','leagues',4);expect(markup).toContain('data-index="1"');expect(markup).not.toContain('data-index="0"');expect(markup).toContain('View 1 decided result')
 })
 it('keeps the website explorer default and labels native saved snapshots without presenting a snapshot count as matches',()=>{
  const points=[{id:'one',date:'2026-10-29',rating:4.42,delta:null,matchId:null}]
  expect(renderToStaticMarkup(<RatingJourneyExplorer points={points}/>)).toContain('Rating trend across 1 reviewed results')
  const native=renderToStaticMarkup(<RatingJourneyExplorer points={points} terminology="snapshots"/>);expect(native).toContain('Rating trend across 1 saved rating');expect(native).toContain('Previous rating');expect(native).toContain('Rating change unavailable for this saved rating.');expect(native).not.toContain('Open scorecard')
 })
})
