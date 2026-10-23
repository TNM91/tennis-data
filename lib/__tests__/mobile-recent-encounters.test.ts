import {describe,expect,it} from 'vitest'
import type {ComparedPlayer} from '../../mobile/src/comparison-data'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
import {recentEncounters,encountersHtml} from '../../mobile/src/recent-encounters'
const row=(id:string,playerId:string,side:string|null):RecentMatchRow=>({id,match_date:'2026-10-20',match_type:'Doubles',league_name:'City',score:'6-4, 6-3',winner_side:'A',match_players:[{player_id:playerId,side}]})
function pair(left:RecentMatchRow[],right:RecentMatchRow[]):ComparedPlayer[]{return [{player:{id:'a',name:'<Alex>',location:null,flight:null},ratings:null,matches:left},{player:{id:'b',name:'Jordan',location:null,flight:null},ratings:null,matches:right}]}
describe('native recent opposing meetings',()=>{
 it('joins by exact match ID and opposing sides, excluding doubles partners and unrelated rows',()=>{
  const players=pair([row('opponent','a','A'),row('partner','a','A'),row('other','a','B')],[row('opponent','b','B'),row('partner','b','A')])
  expect(recentEncounters(players,'overall').matches.map(match=>match.id)).toEqual(['opponent'])
 })
 it('does not count invalid or ambiguous participation as an opposing meeting',()=>{
  const ambiguous=row('duplicate','a','A');ambiguous.match_players.push({player_id:'a',side:'B'})
  const result=recentEncounters(pair([row('invalid','a',null),ambiguous],[row('invalid','b','B'),row('duplicate','b','B')]),'overall')
  expect(result.matches).toEqual([]);expect(result.unconfirmed).toBe(2)
 })
 it('excludes records that disagree across the two bounded reads',()=>{
  const right={...row('one','b','B'),winner_side:'B'}
  expect(recentEncounters(pair([row('one','a','A')],[right]),'overall')).toEqual({matches:[],unconfirmed:1})
 })
 it('respects discipline filtering and deduplicates match IDs',()=>{
  const left=row('one','a','A'),right=row('one','b','B'),players=pair([left,left],[right])
  expect(recentEncounters(players,'doubles').matches).toHaveLength(1);expect(recentEncounters(players,'singles').matches).toEqual([])
 })
 it('keeps unknown winners pending and escapes player/source text',()=>{
  const left={...row('one','a','A'),winner_side:null,score:'<score>'},right={...row('one','b','B'),winner_side:null,score:'<score>'}
  const markup=encountersHtml(pair([left],[right]),'overall')
  expect(markup).toContain('Result pending');expect(markup).toContain('<dt>Pending</dt><dd>1</dd>');expect(markup).toContain('&lt;Alex&gt;');expect(markup).toContain('&lt;score&gt;');expect(markup).not.toContain('<score>')
 })
 it('counts the recorded opposing winner rather than assuming player order',()=>{
  const left={...row('one','a','A'),winner_side:'B'},right={...row('one','b','B'),winner_side:'B'}
  const markup=encountersHtml(pair([left],[right]),'doubles')
  expect(markup).toContain('Jordan won');expect(markup).toContain('<dt>Jordan wins</dt><dd>1</dd>');expect(markup).toContain('&lt;Alex&gt; wins</dt><dd>0</dd>')
 })
 it('does not turn a limited empty sample into a never-met claim',()=>{
  expect(encountersHtml(pair([],[]),'overall')).toContain('does not mean the players have never met')
 })
})
