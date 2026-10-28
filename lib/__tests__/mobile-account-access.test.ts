import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {DEFAULT_ENTITLEMENTS} from '../access-model-core'
import {accountToolIds,parseAccountAccess,readAccountAccess} from '../../mobile/src/account-access'

const owner='11111111-1111-4111-8111-111111111111'
const response=(patch:Record<string,unknown>={})=>({ok:true,access:{role:'member',entitlements:{...DEFAULT_ENTITLEMENTS,...patch}}})
const sessionClient=(getOwner=()=>owner)=>({auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:getOwner()},access_token:'synthetic-token'}},error:null}))}} as unknown as SupabaseClient)

describe('native account tool access',()=>{
 it('recognizes active, trial, canceled-through-period-end and expired access using the website rules',()=>{
  const now=Date.parse('2026-10-28T12:00:00Z')
  for(const status of ['active','trial','canceled']) {
   const access=parseAccountAccess(response({playerPlusSubscriptionActive:true,playerPlusSubscriptionStatus:status,playerPlusAccessExpiresAt:'2026-11-01T00:00:00Z'}))!
   expect(accountToolIds(access,now)).toEqual(['player_plus'])
   expect(accountToolIds(access,Date.parse('2026-11-02T00:00:00Z'))).toEqual([])
  }
  expect(accountToolIds(parseAccountAccess(response({playerPlusSubscriptionStatus:'active'}))!,now)).toEqual([])
 })
 it('preserves inherited player tools and administrator access without describing them as purchased subscriptions',()=>{
  expect(accountToolIds(parseAccountAccess(response({captainSubscriptionActive:true,captainSubscriptionStatus:'active'}))!)).toEqual(['player_plus','captain'])
  expect(accountToolIds(parseAccountAccess(response({coachSubscriptionActive:true,coachSubscriptionStatus:'trial'}))!)).toEqual(['player_plus','coach'])
  expect(accountToolIds(parseAccountAccess({...response(),access:{...response().access,role:'admin'}})!)).toEqual(['player_plus','coach','captain','league'])
 })
 it('rejects unknown roles, missing or mistyped flags, invented statuses and malformed expiry dates',()=>{
  expect(parseAccountAccess({...response(),access:{...response().access,role:'superuser'}})).toBeNull()
  for(const patch of [{playerPlusSubscriptionActive:'true'},{coachSubscriptionActive:undefined},{captainSubscriptionStatus:'premium'},{playerPlusAccessExpiresAt:'forever'},{coachAccessExpiresAt:'1'},{leagueAccessExpiresAt:undefined}])expect(parseAccountAccess(response(patch))).toBeNull()
  for(const value of [null,[],{ok:false},'{}'])expect(parseAccountAccess(value)).toBeNull()
 })
 it('uses a bounded GET to the existing account endpoint, without an owner selector or billing action',async()=>{
  const get=vi.fn(async(_options:unknown)=>(void _options,{status:200,data:response()}))
  await expect(readAccountAccess(sessionClient(),owner,()=>true,{get} as never)).resolves.toMatchObject({role:'member'})
  expect(get).toHaveBeenCalledOnce()
  expect(get.mock.calls[0][0]).toEqual({url:'https://www.tenaceiq.com/api/auth/access',headers:{Authorization:'Bearer synthetic-token'},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 })
 it('never makes a request after the view closes or another account owns the session',async()=>{
  const get=vi.fn()
  await expect(readAccountAccess(sessionClient(),owner,()=>false,{get})).rejects.toThrow('closed')
  await expect(readAccountAccess(sessionClient(()=> 'other'),owner,()=>true,{get})).rejects.toThrow('closed')
  expect(get).not.toHaveBeenCalled()
 })
 it('discards a late response after closing or switching accounts',async()=>{
  let current=true,who=owner
  const closed={get:vi.fn(async()=>{current=false;return {status:200,data:response()}})}
  await expect(readAccountAccess(sessionClient(),owner,()=>current,closed as never)).rejects.toThrow('closed')
  const switched={get:vi.fn(async()=>{who='other';return {status:200,data:response()}})}
  await expect(readAccountAccess(sessionClient(()=>who),owner,()=>true,switched as never)).rejects.toThrow('closed')
 })
 it('does not turn an unavailable or unverified response into free or paid access',async()=>{
  for(const result of [{status:503,data:response()},{status:200,data:{ok:true,access:{role:'admin'}}}])await expect(readAccountAccess(sessionClient(),owner,()=>true,{get:async()=>result} as never)).rejects.toThrow('unavailable')
  await expect(readAccountAccess(sessionClient(),owner,()=>true,{get:async()=>({status:401,data:{ok:false}})} as never)).rejects.toThrow('sign_in_required')
 })
})
