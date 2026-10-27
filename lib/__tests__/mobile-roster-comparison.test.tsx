import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {comparisonSeedPlayers,rosterComparisonPlayers,toggleRosterComparison} from '../../mobile/src/roster-comparison-selection'
import {RosterComparisonPicker} from '../../mobile/src/roster-comparison-picker'
import {TeamRosterCards} from '../../mobile/src/team-roster-view'
import type {TeamRosterPlayer} from '../../mobile/src/team-roster-data'
const row=(id:string,name='Same Name'):TeamRosterPlayer=>({id,name,ntrp:4,player:{id,name,location:'Metro',flight:'4.0',rating_source:null}})
const rows=[row('a'),row('b'),row('c','Casey'),{...row('source','Source only'),player:null}]
describe('exact roster comparison selection',()=>{
 it('selects by identity, preserves order, deselects and replaces the oldest choice with a third',()=>{
  let selected=toggleRosterComparison(rows,[],'a');selected=toggleRosterComparison(rows,selected,'b');expect(selected).toEqual(['a','b']);expect(rosterComparisonPlayers(rows,selected)?.map(p=>p.id)).toEqual(['a','b'])
  expect(toggleRosterComparison(rows,selected,'c')).toEqual(['b','c']);expect(toggleRosterComparison(rows,selected,'a')).toEqual(['b']);expect(selected).toEqual(['a','b'])
 })
 it('withholds missing, duplicate, unresolved and cross-identity roster selections',()=>{
  for(const selected of [[],['a'],['a','a'],['a','missing'],['a','source'],['a','b','c']])expect(rosterComparisonPlayers(rows,selected)).toBeNull()
  expect(rosterComparisonPlayers([...rows,rows[0]],['a','b'])).toBeNull();expect(toggleRosterComparison(rows,['a'],'source')).toEqual(['a']);expect(rosterComparisonPlayers([{...rows[0],player:{...rows[0].player!,id:'other'}},rows[1]],['a','b'])).toBeNull()
 })
 it('validates and copies a bounded pair of seeds rather than sharing caller mutations',()=>{
  const seeds=rosterComparisonPlayers(rows,['a','b'])!,copy=comparisonSeedPlayers(seeds)!;seeds[0].name='Changed';expect(copy[0].name).toBe('Same Name')
  for(const value of [[copy[0],copy[0]],[{...copy[0],id:'bad/id'},copy[1]],[{...copy[0],name:' '},copy[1]],[{...copy[0],location:'x'.repeat(201)},copy[1]]])expect(comparisonSeedPlayers(value)).toBeNull()
 })
 it('keeps selected identities visible in summary when roster search hides their cards',()=>{
  const picker=renderToStaticMarkup(<RosterComparisonPicker rows={rows} selected={['a','b']} onCompare={()=>{}} onClear={()=>{}}/>),cards=renderToStaticMarkup(<TeamRosterCards rows={rows} search="Casey" onSearch={()=>{}} selected={['a','b']} onToggle={()=>{}}/>)
  expect(picker).toContain('Same Name / Same Name');expect(picker).toContain('Compare selected players');expect(picker).not.toContain('disabled');expect(cards).toContain('Casey');expect(cards).not.toContain('Same Name')
 })
 it('escapes selection labels, marks pressed choices and omits actions for unlinked listings',()=>{
  const markup=renderToStaticMarkup(<TeamRosterCards rows={[row('a','<Alex>'),rows[3]]} search="" onSearch={()=>{}} selected={['a']} onToggle={()=>{}}/>);expect(markup).toContain('aria-pressed="true"');expect(markup).toContain('Remove &lt;Alex&gt; from comparison');expect(markup).not.toContain('Select Source only for comparison');expect(markup).not.toContain('<Alex>');expect(markup).not.toContain('style=')
 })
 it('disables comparison until exactly two eligible current roster records are selected',()=>{
  for(const selected of [[],['a'],['a','source']])expect(renderToStaticMarkup(<RosterComparisonPicker rows={rows} selected={selected} onCompare={()=>{}} onClear={()=>{}}/>)).toContain('disabled')
 })
})
