import {describe,it,expect,vi} from 'vitest'
import {readAppLink,createAppLinkHandoff} from '../../mobile/src/app-links'
import {readLinkedMatch} from '../../mobile/src/shared-match-view'
import {appleAppSiteAssociation} from '../apple-app-site-association'
import {androidAppLinks} from '../android-app-links'

const root='https://www.tenaceiq.com',id='12345678-1234-4234-8234-123456789012'
const playerInvite='a'.repeat(64)
describe('native content links',()=>{
 it('opens each destination declared by the Android website association',()=>{
  const rules=androidAppLinks[0].relation_extensions['delegate_permission/common.handle_all_urls'].dynamic_app_link_components
  const paths=[['/coach/invite/*','/coach/invite/test-token'],['/team-room/join','/team-room/join?token='+id],['/team-room','/team-room?team=Baseline+Aces&league=City&flight=4.0'],['/chats/join','/chats/join?invite='+playerInvite],['/chats','/chats?room='+id],['/explore/leagues/tiq/*','/explore/leagues/tiq/'+id],['/tournaments/*','/tournaments/'+id],['/matches/*','/matches/'+id]]
  expect(paths.map(([pattern])=>pattern)).toEqual(rules.filter(rule=>!rule.exclude).map(rule=>rule['/']))
  for(const [,path]of paths)expect(readAppLink(root+path),path).not.toBeNull()
 })
 it('opens only explicit supported content destinations',()=>{
  expect(readAppLink(root+'/coach/invite/test-token')).toEqual({kind:'coach-invite',href:root+'/coach/invite/test-token'})
  expect(readAppLink(root+'/team-room/join?token='+id)?.kind).toBe('team-invite')
  expect(readAppLink(root+'/chats/join?invite='+playerInvite)).toEqual({kind:'player-invite',token:playerInvite})
  expect(readAppLink(root+'/chats?room='+id)).toEqual({kind:'player-chat',id})
  expect(readAppLink(root+'/chats/join?invite='+playerInvite+'&next=/account')).toBeNull()
  expect(readAppLink(root+'/chats?room='+id+'&room='+id)).toBeNull()
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
  expect(components.filter(c=>!c.exclude).map(c=>c['/'])).toEqual(['/coach/invite/*','/team-room/join','/team-room','/chats/join','/chats','/explore/leagues/tiq/*','/tournaments/*','/matches/*'])
  expect(components.filter(c=>c.exclude).map(c=>c['/'])).toEqual(['/coach/invite/*/*','/explore/leagues/tiq/*/*','/tournaments/*/*','/matches/*/*'])
 })
})
function source(launch?:Promise<{url:string}|undefined>){
 let listener:(event:{url:string})=>void=()=>{};const remove=vi.fn(async()=>{})
 return {remove,emit:(url:string)=>listener({url}),plugin:{addListener:vi.fn(async(_name:string,fn:(e:{url:string})=>void)=>{listener=fn;return {remove}}),getLaunchUrl:vi.fn(()=>launch||Promise.resolve(undefined))}}
}
describe('account-bound shared link handoff',()=>{
 it('lets a dismissed invitation be reopened immediately',async()=>{
  const s=source(),h=createAppLinkHandoff(vi.fn(),s.plugin as never);await h.ready
  h.setOwner('A');h.receive(root+'/coach/invite/a');h.clear()
  expect(h.receive(root+'/coach/invite/a')).toBe(true)
  expect(h.peek()).toEqual({kind:'coach-invite',href:root+'/coach/invite/a'});h.dispose()
 })
 it('does not suppress a fresh tap of the same invitation after an account switch',async()=>{
  const s=source(),h=createAppLinkHandoff(vi.fn(),s.plugin as never);await h.ready
  h.setOwner('A');h.receive(root+'/tournaments/'+id);h.setOwner('B')
  expect(h.peek()).toBeNull();h.receive(root+'/tournaments/'+id)
  expect(h.take('B')).toEqual({kind:'tournament',id});h.dispose()
 })
 it('discards a delayed cold launch after sign-out or an established account switch',async()=>{
  for(const next of [null,'B']){
   let complete!:(value:{url:string})=>void
   const s=source(new Promise(resolve=>{complete=resolve})),h=createAppLinkHandoff(vi.fn(),s.plugin as never)
   h.setOwner('A');await Promise.resolve();expect(s.plugin.getLaunchUrl).toHaveBeenCalledOnce()
   h.setOwner(next);complete({url:root+'/coach/invite/a'});await h.ready
   expect(h.peek()).toBeNull();h.dispose()
  }
 })
 it('retains a delayed cold invitation through the initial sign-in',async()=>{
  let complete!:(value:{url:string})=>void
  const s=source(new Promise(resolve=>{complete=resolve})),h=createAppLinkHandoff(vi.fn(),s.plugin as never)
  await Promise.resolve();h.setOwner('A');complete({url:root+'/tournaments/'+id});await h.ready
  expect(h.take('A')).toEqual({kind:'tournament',id});h.dispose()
 })
 it('does not replace a newer in-app link with a delayed launch lookup',async()=>{
  let complete!:(value:{url:string})=>void
  const s=source(new Promise(resolve=>{complete=resolve})),h=createAppLinkHandoff(vi.fn(),s.plugin as never)
  await Promise.resolve();h.receive(root+'/tournaments/newest');complete({url:root+'/tournaments/old'});await h.ready
  expect(h.peek()).toEqual({kind:'tournament',id:'newest'});h.dispose()
 })
 it('does not revive a dismissed in-app link when an older launch lookup finishes',async()=>{
  let complete!:(value:{url:string})=>void
  const s=source(new Promise(resolve=>{complete=resolve})),h=createAppLinkHandoff(vi.fn(),s.plugin as never)
  await Promise.resolve();h.receive(root+'/coach/invite/new');h.clear();complete({url:root+'/coach/invite/old'});await h.ready
  expect(h.peek()).toBeNull();h.dispose()
 })
 it('still suppresses duplicate native deliveries after consumption and then accepts a new tap',async()=>{
  let time=10000;const s=source(),h=createAppLinkHandoff(vi.fn(),s.plugin as never,()=>time);await h.ready
  h.setOwner('A');h.receive(root+'/tournaments/'+id);expect(h.take('A')).toEqual({kind:'tournament',id})
  h.receive(root+'/tournaments/'+id);expect(h.peek()).toBeNull()
  time+=1500;h.receive(root+'/tournaments/'+id);expect(h.take('A')).toEqual({kind:'tournament',id});h.dispose()
 })
 it('expires an idle pending invitation without another tap or poll',async()=>{
  vi.useFakeTimers();const changed=vi.fn(),s=source(),h=createAppLinkHandoff(changed,s.plugin as never)
  try{await h.ready;h.setOwner('A');h.receive(root+'/coach/invite/a')
   vi.advanceTimersByTime(600000);expect(changed).toHaveBeenLastCalledWith(null,false)
   expect(h.peek()).toBeNull();expect(vi.getTimerCount()).toBe(0)
  }finally{h.dispose();vi.useRealTimers()}
 })
 it('keeps a newer invitation when the earlier invitation would have expired',async()=>{
  vi.useFakeTimers();const s=source(),h=createAppLinkHandoff(vi.fn(),s.plugin as never)
  try{await h.ready;h.setOwner('A');h.receive(root+'/coach/invite/old')
   vi.advanceTimersByTime(400000);h.receive(root+'/coach/invite/new')
   vi.advanceTimersByTime(200000);expect(h.peek()).toEqual({kind:'coach-invite',href:root+'/coach/invite/new'})
   vi.advanceTimersByTime(400000);expect(h.peek()).toBeNull()
  }finally{h.dispose();vi.useRealTimers()}
 })
 it('does not update a disposed handoff after its expiry time',async()=>{
  vi.useFakeTimers();const changed=vi.fn(),s=source(),h=createAppLinkHandoff(changed,s.plugin as never)
  try{await h.ready;h.receive(root+'/coach/invite/a');h.dispose()
   vi.advanceTimersByTime(600001);expect(changed).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0)
  }finally{h.dispose();vi.useRealTimers()}
 })
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
