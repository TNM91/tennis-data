import {describe,expect,it} from 'vitest'
import type {MatchLineupCourt,SavedTeamLineup} from '../team-match-lineup-contract'
import type {TeamLineupPlayer} from '../team-match-replies-contract'
import {lineupPublishComparison,lineupPublishPreviewHtml} from '../../mobile/src/team-lineup-publication'
import {lineupNames} from '../../mobile/src/team-match-lineup'

const roster=(...ids:string[]):TeamLineupPlayer[]=>ids.map(id=>({id,name:id.toUpperCase(),choice:'in'}))
const saved=(courts:MatchLineupCourt[],names:Record<string,string>):SavedTeamLineup=>({version:'published',courts,names})

describe('captain lineup publishing comparison',()=>{
 it('detects a same-name replacement even after the original player leaves the roster',()=>{
  const before=saved([{format:'singles',players:['old-1111']}],{'old-1111':'Alex'})
  const courts:MatchLineupCourt[]=[{format:'singles',players:['new-2222']}]
  const players:TeamLineupPlayer[]=[{id:'new-2222',name:'Alex',choice:'in'}]
  const comparison=lineupPublishComparison(courts,players,before)
  expect(comparison.counts).toEqual({new:0,changed:1,removed:0,unchanged:0})
  expect(comparison.changes[0]).toMatchObject({label:'Singles 1',players:'Alex (2222)',before:'Alex (1111)',status:'changed'})
  const markup=lineupPublishPreviewHtml(courts,players,before)
  expect(markup).toContain('Previously · Alex (1111)');expect(markup).toContain('Alex (2222)')
 })
 it('compares the right courts in mixed singles/doubles plans and identifies added and removed courts',()=>{
  const before=saved([{format:'singles',players:['a']},{format:'doubles',players:['b','c']},{format:'doubles',players:['d','e']}],
   {a:'A',b:'B',c:'C',d:'D',e:'E'})
  const after:MatchLineupCourt[]=[{format:'doubles',players:['b','c']},{format:'singles',players:['f']},{format:'singles',players:['g']}]
  const snapshot=structuredClone({before,after}),comparison=lineupPublishComparison(after,roster('a','b','c','d','e','f','g'),before)
  expect(comparison.counts).toEqual({new:1,changed:1,removed:1,unchanged:1})
  expect(comparison.changes.map(row=>[row.label,row.status,row.before,row.players])).toEqual([
   ['Singles 1','changed','A','F'],['Singles 2','new',undefined,'G'],['Doubles 2','removed','D & E','D & E']])
  expect(comparison.unchanged.map(row=>row.label)).toEqual(['Doubles 1'])
  expect({before,after}).toEqual(snapshot)
 })
 it('does not mistake a display-name update or reversed doubles list for a changed assignment',()=>{
  const before=saved([{format:'doubles',players:['a','b']}],{a:'Old name',b:'B'})
  const after:MatchLineupCourt[]=[{format:'doubles',players:['b','a']}]
  const comparison=lineupPublishComparison(after,roster('a','b'),before)
  expect(comparison.counts).toEqual({new:0,changed:0,removed:0,unchanged:1})
  const markup=lineupPublishPreviewHtml(after,roster('a','b'),before)
  expect(markup).toContain('No court assignment changes.')
  expect(markup).toContain('Unchanged courts (1)');expect(markup).toContain('need to confirm this version')
  expect(markup).not.toContain('data-lineup-change="changed"')
 })
 it('shows the original players on removed courts and escapes names in both versions',()=>{
  const before=saved([{format:'singles',players:['old']},{format:'doubles',players:['removed','partner']}],
   {old:'<Old>',removed:'<Removed>',partner:'"Partner"'})
  const players:TeamLineupPlayer[]=[{id:'new',name:'<New>',choice:'in'}]
  const markup=lineupPublishPreviewHtml([{format:'singles',players:['new']}],players,before)
  for(const name of ['Old','New','Removed']){expect(markup).toContain(`&lt;${name}&gt;`);expect(markup).not.toContain(`<${name}>`)}
  expect(markup).toContain('Previously · &lt;Removed&gt; &amp; &quot;Partner&quot;')
  expect(markup).toContain('1 updated · 1 removed')
 })
 it('handles the first publication without inventing a previous assignment',()=>{
  const courts:MatchLineupCourt[]=[{format:'singles',players:['a']},{format:'doubles',players:['b','c']}]
  const comparison=lineupPublishComparison(courts,roster('a','b','c'))
  expect(comparison.counts).toEqual({new:2,changed:0,removed:0,unchanged:0})
  const markup=lineupPublishPreviewHtml(courts,roster('a','b','c'))
  expect(markup).toContain('2 courts to publish');expect(markup).not.toContain('Previously')
  expect(markup).not.toContain('Unchanged courts')
 })
 it('keeps same-name tags distinct when player identifiers share their last four characters',()=>{
  const players=[{id:'11111111-1111-4111-8111-111111111111',name:'Alex'},
   {id:'22222222-2222-4222-8222-222222221111',name:'Alex'},{id:'other',name:'Blair'}]
  const names=lineupNames(players)
  expect(names.get(players[0].id)).toBe('Alex (111111)')
  expect(names.get(players[1].id)).toBe('Alex (221111)')
  expect(names.get('other')).toBe('Blair')
  expect(new Set(names.values()).size).toBe(3)
 })
})
