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
 it('marks only the recorded winner, regardless of which side is listed first',()=>{
  const lost=renderMatchSetScores(row,'player')
  expect(lost).toMatch(/<tr data-match-winner>\s*<th scope="row"><span data-scorecard-side="A">Opponent<\/span> <span class="match-winner-marker">Winner<\/span>/)
  expect(lost.match(/data-match-winner/g)).toHaveLength(1)
  const won=renderMatchSetScores({...row,winner_side:'B'},'player')
  expect(won).toMatch(/<tr data-match-winner>\s*<th scope="row"><span data-scorecard-side="B">Your side<\/span> <span class="match-winner-marker">Winner<\/span>/)
  expect(won.match(/data-match-winner/g)).toHaveLength(1)
 })
 it('orients shared sets by the recorded winner in either source column order',()=>{
  for(const score of ['6-4 3-6 10-8','4-6 6-3 8-10']){
   const view=renderMatchSetScores({...row,score,winner_side:'B',match_players:[]},null)
   expect(view).toContain('Scores for Side A and Side B')
   expect(view).toMatch(/data-scorecard-side="A">Side A<\/span><\/th>\s*<td>4<\/td><td><strong>6<\/strong><\/td><td>8<\/td>/)
   expect(view).toMatch(/data-scorecard-side="B">Side B<\/span> <span class="match-winner-marker">Winner<\/span><\/th>\s*<td><strong>6<\/strong><\/td><td>3<\/td><td><strong>10<\/strong><\/td>/)
  }
 })
 it('shows no shared breakdown when the recorded result is missing or incomplete',()=>{
  expect(renderMatchSetScores({...row,winner_side:null,match_players:[]},null)).toBe('')
  expect(renderMatchSetScores({...row,score:'RET',match_players:[]},null)).toBe('')
 })
})
