import {describe,expect,it} from 'vitest'
import type {MatchLineupCourt} from '../team-match-lineup-contract'
import type {TeamLineupPlayer} from '../team-match-replies-contract'
import {lineupReplacementContext,lineupReplacementHtml,lineupReplacementTarget,replaceLineupPlayer} from '../../mobile/src/team-lineup-replacement'

const courts=():MatchLineupCourt[]=>[{format:'doubles',players:['alex','casey']},{format:'singles',players:['riley']}]
const roster=():TeamLineupPlayer[]=>[
 {id:'alex',name:'Alex',choice:'in'},{id:'casey',name:'Casey',choice:'out'},
 {id:'riley',name:'Riley',choice:'in'},{id:'morgan',name:'Morgan',choice:'in'},
 {id:'maybe',name:'Maybe player',choice:'maybe'},{id:'waiting',name:'Waiting player',choice:null},
]

describe('captain court replacements',()=>{
 it('offers only unassigned In players and preserves partner and court context',()=>{
  const target=lineupReplacementTarget(courts(),0,1)!
  expect(lineupReplacementContext(courts(),roster(),target)).toMatchObject({label:'Doubles 1',slot:2,current:'Casey',partner:'Alex',candidates:[{id:'morgan',name:'Morgan'}]})
  const before=courts(),snapshot=structuredClone(before),after=replaceLineupPlayer(before,roster(),target,'morgan')
  expect(before).toEqual(snapshot)
  expect(after).toEqual([{format:'doubles',players:['alex','morgan']},{format:'singles',players:['riley']}])
  expect(after[1]).not.toBe(before[1])
 })
 it('rejects stale targets and invalid court or player positions',()=>{
  for(const [court,slot] of [[-1,0],[0,-1],[1,1],[0,2],[0.5,0],[9,0]])expect(lineupReplacementTarget(courts(),court,slot)).toBeNull()
  const target=lineupReplacementTarget(courts(),0,1)!,changed=courts()
  changed[0].players[1]='other'
  expect(lineupReplacementContext(changed,roster(),target)).toBeNull()
  expect(()=>replaceLineupPlayer(changed,roster(),target,'morgan')).toThrow('This court changed')
 })
 it('rechecks eligibility rather than using a candidate from an older list',()=>{
  const target=lineupReplacementTarget(courts(),0,1)!
  for(const id of ['alex','riley','casey','maybe','waiting','missing'])expect(()=>replaceLineupPlayer(courts(),roster(),target,id)).toThrow('no longer marked In')
  const changed=roster();changed.find(player=>player.id==='morgan')!.choice='out'
  expect(()=>replaceLineupPlayer(courts(),changed,target,'morgan')).toThrow('no longer marked In')
  expect(()=>replaceLineupPlayer(courts(),roster().filter(player=>player.id!=='morgan'),target,'morgan')).toThrow('no longer marked In')
 })
 it('fills a vacant singles spot without changing other courts',()=>{
  const plan=courts();plan[1].players[0]=''
  const target=lineupReplacementTarget(plan,1,0)!
  expect(lineupReplacementContext(plan,roster(),target)).toMatchObject({label:'Singles 1',current:'Open spot',partner:null})
  expect(replaceLineupPlayer(plan,roster(),target,'riley')).toEqual(courts())
 })
 it('distinguishes same-name teammates and escapes display names in both text and action labels',()=>{
  const players=roster();players.push({id:'second-morgan-1234',name:'Morgan',choice:'in'},{id:'markup',name:'<Blair> "Ace"',choice:'in'})
  const target=lineupReplacementTarget(courts(),0,1)!,markup=lineupReplacementHtml(courts(),players,target,false)
  expect(markup).toContain('Morgan (RGAN)');expect(markup).toContain('Morgan (1234)')
  expect(markup).toContain('&lt;Blair&gt; &quot;Ace&quot;');expect(markup).not.toContain('<Blair>')
  expect(markup).toContain('Only the teammates loaded here are shown')
 })
 it('keeps empty replacement lists usable and identifies removed players without treating them as available',()=>{
  const players=roster().filter(player=>!['morgan','casey'].includes(player.id)),target=lineupReplacementTarget(courts(),0,1)!
  const markup=lineupReplacementHtml(courts(),players,target,true)
  expect(markup).toContain('Player no longer on roster')
  expect(markup).toContain('No unassigned teammates are marked In')
  expect(markup).toContain('Back to lineup');expect(markup).not.toContain('data-choose-lineup-replacement')
 })
})
