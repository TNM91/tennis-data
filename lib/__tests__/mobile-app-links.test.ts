import {describe,it,expect,vi} from 'vitest'
import {readAppLink,createAppLinkHandoff} from '../../mobile/src/app-links'
import {readLinkedMatch} from '../../mobile/src/shared-match-view'
import {appleAppSiteAssociation} from '../apple-app-site-association'

const root='https://www.tenaceiq.com',id='12345678-1234-4234-8234-123456789012'
describe('native content links',()=>{
 it('opens only explicit supported content destinations',()=>{
  expect(readAppLink(root+'/coach/invite/test-token')).toEqual({kind:'coach-invite',href:root+'/coach/invite/test-token'})
  expect(readAppLink(root+'/team-room/join?token='+id)?.kind).toBe('team-invite')
  expect(readAppLink(root+'/team-room?team=Baseline+Aces&league=City&flight=4.0')).toEqual({kind:'chat',scope:{teamName:'Baseline Aces',leagueName:'City',flight:'4.0'}})
  for(const [path,kind] of [['explore/leagues/tiq','league'],['tournaments','tournament'],['matches','match']])expect(readAppLink(root+'/'+path+'/'+id)).toEqual({kind,id})
  expect(readAppLink(root+'/matches/'+id+'?via=scorecard-share')?.kind).toBe('match')
 })
 it('rejects untrusted hosts, auth/billing routes, malformed scopes and redirect parameters',()=>{
  for(const href of [root+'/auth/callback?code=secret',root+'/account',root+'/api/mobile/coach',root+'/tournaments/a?next=https://evil.test',root+'/team-room?team=T&team=X&league=L',root+'/team-room?team=T&league=L&chatRoom=bad',root+'/team-room?team=T&league=L&message=bad',root+'/team-room?team=%00&league=L',root+'/coach/invite/a?token=b',root+'/team-room/join?token='+id+'&next=/account','https://www.tenaceiq.com.evil.test/tournaments/a','https://www.tenaceiq.com@evil.test/tournaments/a','http://www.tenaceiq.com/tournaments/a',root+'/tournaments/%2fadmin',root+'/tournaments/a#admin',root+'/tournaments/a\\b','javascript:alert(1)'])expect(readAppLink(href),href).toBeNull()
 })
 it('publishes only content associations for the verified app identifier',()=>{
  expect(appleAppSiteAssociation.applinks.details[0].appIDs).toEqual(['6C5MPYLRVQ.com.tenaceiq.app'])
  const components=appleAppSiteAssociation.applinks.details[0].components
  expect(components.filter(c=>!c.exclude).map(c=>c['/'])).toEqual(['/coach/invite/*','/team-room/join','/team-room','/explore/leagues/tiq/*','/tournaments/*','/matches/*'])
  expect(components.filter(c=>c.exclude).map(c=>c['/'])).toEqual(['/coach/invite/*/*','/explore/leagues/tiq/*/*','/tournaments/*/*','/matches/*/*'])
 })
})
function source(launch?:Promise<{url:string}|undefined>){
 let listener:(event:{url:string})=>void=()=>{};const remove=vi.fn(async()=>{})
 return {remove,emit:(url:string)=>listener({url}),plugin:{addListener:vi.fn(async(_name:string,fn:(e:{url:string})=>void)=>{listener=fn;return {remove}}),getLaunchUrl:vi.fn(()=>launch||Promise.resolve(undefined))}}
}
describe('account-bound shared link handoff',()=>{
 it('continues a cold link after sign-in, consumes once and keeps no persistent copy',async()=>{
  const s=source(Promise.resolve({url:root+'/tournaments/'+id})),changed=vi.fn(),h=createAppLinkHandoff(changed,s.plugin as never)
  await h.ready;expect(h.take('owner')).toBeNull();h.setOwner('owner');expect(h.take('other')).toBeNull();expect(h.take('owner')).toEqual({kind:'tournament',id});expect(h.peek()).toBeNull();h.dispose();expect(s.remove).toHaveBeenCalledOnce()
 })
 it('drops an old account link on sign-out and direct account switch',async()=>{
  const s=source(),h=createAppLinkHandoff(vi.fn(),s.plugin as never);await h.ready
  h.setOwner('A');h.receive(root+'/coach/invite/a');h.setOwner(null);h.setOwner('B');expect(h.take('B')).toBeNull()
  h.receive(root+'/tournaments/'+id);h.setOwner('C');expect(h.peek()).toBeNull();h.dispose()
 })
 it('does not let a late cold launch URL replace a newer warm arrival',async()=>{
  let complete!:(value:{url:string})=>void;const s=source(new Promise(r=>{complete=r})),h=createAppLinkHandoff(vi.fn(),s.plugin as never)
  await Promise.resolve();s.emit(root+'/tournaments/newest');complete({url:root+'/tournaments/old'});await h.ready;expect(h.peek()).toEqual({kind:'tournament',id:'newest'});h.dispose()
 })
 it('deduplicates launch deliveries, expires secrets, and ignores unsupported links',async()=>{
  let time=10000;const s=source(),changed=vi.fn(),h=createAppLinkHandoff(changed,s.plugin as never,()=>time);await h.ready
  h.receive(root+'/coach/invite/a');h.receive(root+'/coach/invite/a');h.receive('https://evil.test/tournaments/a');expect(changed).toHaveBeenCalledTimes(1)
  time+=600001;expect(h.peek()).toBeNull();h.dispose();s.emit(root+'/coach/invite/b');expect(h.peek()).toBeNull()
 })
})
it('shared courts remain neutral and reject team totals, private and future records',()=>{
 const row={id,match_date:'2026-10-28',match_type:'doubles',league_name:'City',score:'6-4, 6-3',winner_side:'A',public_history_eligible:true}
 expect(readLinkedMatch(row,id,'2026-10-31').match_players).toEqual([])
 for(const bad of [{...row,match_type:'team'},{...row,public_history_eligible:false},{...row,match_date:'2027-01-01'},{...row,id:'other'}])expect(()=>readLinkedMatch(bad,id,'2026-10-31')).toThrow()
})
