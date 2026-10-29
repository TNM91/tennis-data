import {describe,it,expect} from 'vitest'
import {statDonutHtml} from '../../mobile/src/stat-donut'
import {labRecentFormHtml,labRecentSample} from '../../mobile/src/lab-recent-form'
import {labLevelPathHtml} from '../../mobile/src/lab-level-path'
import {ratingsHtml} from '../../mobile/src/player-ratings-view'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const row=(id:string,winner:string|null='B',type='doubles'):RecentMatchRow=>({id,match_type:type,match_date:'2026-10-28',league_name:'City',winner_side:winner,score:'6-4 6-3',match_players:[{player_id:'owner',side:'B'}]})
describe('native My Lab visual evidence',()=>{
 it('keeps the linked player side and original scorecard indexes, excluding team totals and repeated courts',()=>{
  const rows=[row('team','B','team'),row('pending',null),row('court'),row('court'),row('loss','A',' Singles '),{...row('unrelated'),match_players:[{player_id:'other',side:'B'}]}]
  expect(labRecentSample(rows,'owner').map(item=>({id:item.row.id,index:item.index,outcome:item.outcome,format:item.format}))).toEqual([{id:'court',index:2,outcome:'Won',format:'doubles'},{id:'loss',index:4,outcome:'Lost',format:'singles'}])
  const output=labRecentFormHtml(rows,'owner');expect(output).toContain('1W · 1L');expect(output).toContain('stroke-dasharray="50 100"');expect(output).toContain('data-lab-form-index="2"');expect(output).toContain('data-lab-form-index="4"');expect(output).not.toContain('data-lab-form-index="0"')
 })
 it('takes only the newest five decided courts and does not treat a pending newest copy as a past win',()=>{
  const rows=[row('same',null),row('same'),...Array.from({length:8},(_,index)=>row('court-'+index,index===1?'A':'B'))]
  expect(labRecentSample(rows,'owner')).toHaveLength(5);expect(labRecentSample(rows,'owner')[0].index).toBe(2)
  expect(labRecentFormHtml(rows,'owner')).toContain('4W · 1L');expect(labRecentFormHtml(rows,'owner')).toContain('Latest 5 decided results in your loaded matches')
  expect(labRecentFormHtml(rows,'other')).toBe('');expect(labRecentFormHtml([row('pending',null)],'owner')).toBe('')
 })
 it('distinguishes a zero win rate from unavailable data and never emits invalid chart coordinates or markup',()=>{
  expect(statDonutHtml(0,'Recent wins')).toContain('Recent wins: 0%');expect(statDonutHtml(0,'Recent wins')).not.toContain('stat-donut-fill')
  expect(statDonutHtml(100,'Recent wins')).toContain('stroke-dasharray="100 100"')
  for(const value of [null,NaN,Infinity,-1,101]){const chart=statDonutHtml(value,'<Recent>');expect(chart).toContain('no decided results');expect(chart).not.toContain('stat-donut-fill');expect(chart).not.toMatch(/NaN|Infinity|<Recent>/)}
  expect(statDonutHtml(100,'<Recent>')).toContain('&lt;Recent&gt;')
 })
 it('keeps real format ratings and explicit fallback context without displaying unpublished USTA dynamic values',()=>{
  const player={overall_rating:4,overall_dynamic_rating:4.42,singles_dynamic_rating:null,doubles_dynamic_rating:4.49,rating_source:'verified',overall_usta_dynamic_rating:4.31}
  const output=ratingsHtml(player,true,true);expect(output).toContain('Overall TIQ');expect(output).toContain('Singles TIQ');expect(output).toContain('Overall used');expect(output).toContain('4.49');expect(output).toContain('USTA current: <strong>4.0</strong>');expect(output).not.toContain('4.31')
 })
 it('connects a valid TIQ band to the existing drill catalog and does not invent a target for self-rated or top-band records',()=>{
  const player={overall_rating:4,overall_dynamic_rating:4.42,rating_source:'verified'}
  const output=labLevelPathHtml(player);expect(output).toContain('0.08 TIQ points');expect(output).toContain('4.5');expect(output).toContain('data-training="catalog"');expect(output).toContain('value="84"');expect(output).toContain('does not measure change over time')
  expect(labLevelPathHtml({...player,rating_source:'self'})).not.toContain('<meter');expect(labLevelPathHtml({...player,overall_dynamic_rating:7})).not.toContain('7.5')
 })
})
