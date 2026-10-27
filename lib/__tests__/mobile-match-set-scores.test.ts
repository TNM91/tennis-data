import {describe,it,expect} from 'vitest'
import {matchSetScores,renderMatchSetScores} from '../../mobile/src/match-set-scores'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const row:RecentMatchRow={id:'match',match_date:'2026-10-25',match_type:'Singles',league_name:'City',score:'6-4 6-3',winner_side:'A',match_players:[{player_id:'player',side:'B'}]}
describe('match set score display',()=>{
 it('uses recorded result to orient both source score orders',()=>{
  for(const score of ['6-4 6-3','4-6 3-6'])expect(matchSetScores({...row,score},'player')).toEqual([{kind:'set',gamesFor:4,gamesAgainst:6},{kind:'set',gamesFor:3,gamesAgainst:6}])
 })
 it('keeps the deciding match tiebreak distinct from games',()=>{
  expect(matchSetScores({...row,score:'6-4 3-6 10-8'},'player')?.[2]).toEqual({kind:'match_tiebreak',gamesFor:8,gamesAgainst:10})
  expect(renderMatchSetScores({...row,score:'6-4 3-6 1-0'},'player')).toContain('Match tiebreak')
 })
 it('withholds attribution for missing, conflicting or unknown participation and results',()=>{
  for(const changed of [{winner_side:null},{winner_side:'C'},{match_players:[]},{match_players:[{player_id:'player',side:null}]},{match_players:[{player_id:'player',side:'A'},{player_id:'player',side:'B'}]}])expect(matchSetScores({...row,...changed},'player')).toBeNull()
 })
 it('keeps incomplete or nonstandard scores in the source record only',()=>{
  for(const score of ['6-4','RET','default','6-4 2-1',null])expect(renderMatchSetScores({...row,score},'player')).toBe('')
 })
 it('escapes profile names and provides accessible column and row labels',()=>{
  const view=renderMatchSetScores(row,'player','<Captain>')
  expect(view).toContain('&lt;Captain&gt;');expect(view).not.toContain('<Captain>');expect(view).toContain('scope="row"');expect(view).toContain('scope="col"');expect(view).toContain('Opponent')
 })
})
