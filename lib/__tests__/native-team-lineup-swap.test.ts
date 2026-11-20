import {describe,expect,it} from 'vitest'
import type {MatchLineupCourt} from '../team-match-lineup-contract'
import type {TeamLineupPlayer} from '../team-match-replies-contract'
import {lineupSwapContext,lineupSwapReviewHtml,swapLineupPlayers} from '../../mobile/src/team-lineup-swap'
import {lineupReplacementHtml} from '../../mobile/src/team-lineup-replacement'

const courts=():MatchLineupCourt[]=>[{format:'doubles',players:['alex','casey']},{format:'singles',players:['riley']}]
const roster=():TeamLineupPlayer[]=>[{id:'alex',name:'Alex',choice:'in'},{id:'casey',name:'Casey',choice:'in'},
 {id:'riley',name:'Riley',choice:'in'},{id:'morgan',name:'Morgan',choice:'in'}]
const source={court:0,slot:0,player:'alex'},other={court:1,slot:0,player:'riley'}

describe('private court swaps',()=>{
 it('offers only In players assigned on another court, keeping replacements distinct',()=>{
  expect(lineupSwapContext(courts(),roster(),source)?.candidates).toEqual([{id:'riley',name:'Riley',court:1,slot:0,label:'Singles 1',partner:null}])
  const markup=lineupReplacementHtml(courts(),roster(),source,true)
  expect(markup).toContain('data-choose-lineup-replacement="morgan"')
  expect(markup).toContain('data-review-lineup-swap="riley"')
  expect(markup).not.toContain('data-review-lineup-swap="casey"')
  expect(markup).not.toContain('data-review-lineup-swap="morgan"')
 })
 it('moves both players between doubles and singles without mutating the working plan',()=>{
  const before=courts(),saved=structuredClone(before),after=swapLineupPlayers(before,roster(),source,other)
  expect(before).toEqual(saved)
  expect(after).toEqual([{format:'doubles',players:['riley','casey']},{format:'singles',players:['alex']}])
  expect(after[0]).not.toBe(before[0])
 })
 it('keeps both doubles partners and every unrelated court in place',()=>{
  const before:MatchLineupCourt[]=[{format:'doubles',players:['alex','casey']},{format:'doubles',players:['riley','jordan']},{format:'singles',players:['morgan']}]
  const after=swapLineupPlayers(before,[...roster(),{id:'jordan',name:'Jordan',choice:'in'}],source,other)
  expect(after).toEqual([{format:'doubles',players:['riley','casey']},{format:'doubles',players:['alex','jordan']},{format:'singles',players:['morgan']}])
  expect(before[0].players).toEqual(['alex','casey']);expect(before[1].players).toEqual(['riley','jordan'])
 })
 it.each(['maybe','out',null] as const)('rechecks both players when availability changes to %s',choice=>{
  const players=roster();players[0].choice=choice
  expect(()=>swapLineupPlayers(courts(),players,source,other)).toThrow('Both players must be marked In')
  players[0].choice='in';players[2].choice=choice
  expect(()=>swapLineupPlayers(courts(),players,source,other)).toThrow('no longer marked In')
 })
 it('rejects a removed player, moved destination or same-court partner',()=>{
  expect(()=>swapLineupPlayers(courts(),roster().filter(row=>row.id!=='riley'),source,other)).toThrow('no longer marked In')
  expect(()=>swapLineupPlayers(courts(),roster(),source,{court:0,slot:1,player:'casey'})).toThrow('other assignment changed')
  expect(()=>swapLineupPlayers(courts(),roster(),source,{...other,slot:1})).toThrow('other assignment changed')
  expect(()=>swapLineupPlayers(courts(),roster(),{...source,player:'moved'},other)).toThrow('This court changed')
  for(const court of [-1,.5,12])expect(lineupSwapContext(courts(),roster(),{...source,court})).toBeNull()
 })
 it('does not offer swaps for duplicate assignments or an empty spot',()=>{
  const before=courts();before[1].players[0]='alex'
  expect(()=>swapLineupPlayers(before,roster(),source,other)).toThrow('Use each player once')
  before[0].players[0]=''
  expect(lineupSwapContext(before,roster(),{...source,player:''})?.candidates).toEqual([])
 })
 it('reviews only the affected courts with escaped names and clear private-plan actions',()=>{
  const before=[...courts(),{format:'singles' as const,players:['morgan']}]
  const after=swapLineupPlayers(before,roster(),source,other)
  const markup=lineupSwapReviewHtml({before,after,source,other,version:'saved',names:{alex:'<Alex>',casey:'Casey',riley:'Riley "Ace"',morgan:'Unchanged Morgan'}})
  expect(markup).toContain('Before · &lt;Alex&gt; &amp; Casey')
  expect(markup).toContain('After · Riley &quot;Ace&quot; &amp; Casey')
  expect(markup).not.toContain('<Alex>');expect(markup).not.toContain('Unchanged Morgan')
  expect(markup).toContain('Apply swap to private plan');expect(markup).toContain('Back to players')
 })
})
