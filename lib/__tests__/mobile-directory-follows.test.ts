import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {LeagueCard} from '../league-summary'
import {collectTeams} from '../../mobile/src/directory-data'
import {directoryFollowItem,directoryFollowStatus,saveDirectoryFollow,type DirectoryFollow} from '../../mobile/src/directory-follow-data'
const team={name:'Aces',league:'City',flight:'4.0',source:'recorded' as const,followLayer:'usta' as const}
const item:DirectoryFollow={entity_type:'team',entity_id:'usta__Aces__City__4.0',entity_name:'Aces',subtitle:'City - 4.0'}
function fixture(){
 const session={user:{id:'owner'},access_token:'synthetic'},getSession=vi.fn().mockResolvedValue({data:{session},error:null})
 const query={select:vi.fn(),eq:vi.fn(),limit:vi.fn(),abortSignal:vi.fn().mockResolvedValue({data:[],error:null})};for(const f of [query.select,query.eq,query.limit])f.mockReturnValue(query)
 return {session,getSession,query,client:{auth:{getSession},from:()=>query} as unknown as SupabaseClient}
}
describe('directory follow identity and access',()=>{
 it('uses website scoped team IDs only with known context and bounds all payloads',()=>{
  expect(directoryFollowItem(team)).toEqual(item)
  for(const value of [{...team,followLayer:undefined},{...team,league:null},{...team,flight:''},{...team,name:'A__B'},{...team,name:'A'.repeat(201)},{...team,league:'x'.repeat(161)}])expect(directoryFollowItem(value)).toBeNull()
 })
 it('keeps the exact normalized website directory league key and rejects inconsistent scope',()=>{
  const row={key:'usta__city league__4.0__midwest__metro',leagueName:'City League',flight:'4.0',ustaSection:'Midwest',districtArea:'Metro',competitionLayer:'usta'} as LeagueCard
  expect(directoryFollowItem(row)).toEqual({entity_type:'league',entity_id:row.key,entity_name:'City League',subtitle:'4.0 - Midwest - Metro'})
  for(const value of [{...row,key:'different'},{...row,flight:'4.5'},{...row,competitionLayer:'tiq'},{...row,districtArea:'A__B'}])expect(directoryFollowItem(value as LeagueCard)).toBeNull()
 })
 it('derives USTA follow context from recorded area or website league markers, without defaulting unknown teams',()=>{
  const row={home_team:'Aces',away_team:'Rallies',league_name:'City',flight:'4.0',source:'schedule'}
  expect(collectTeams([row],[],'Aces')[0].followLayer).toBeUndefined()
  expect(collectTeams([row,{...row,usta_section:'Midwest'}],[],'Aces')[0].followLayer).toBe('usta')
  expect(collectTeams([{...row,league_name:'USTA City'}],[],'Aces')[0].followLayer).toBe('usta')
  expect(collectTeams([{...row,league_name:'TIQ City',usta_section:'Midwest'}],[],'Aces').every(t=>!t.followLayer)).toBe(true)
 })
 it('reads only the exact owner/type/id, and lets existing follows be removed without an access request',async()=>{
  const f=fixture(),access=vi.fn();f.query.abortSignal.mockResolvedValue({data:[{id:'one'}],error:null})
  expect(await directoryFollowStatus(f.client,item,()=>true,access)).toEqual({ownerId:'owner',following:true,canAdd:true})
  expect(access).not.toHaveBeenCalled();expect(f.query.eq.mock.calls).toEqual([['user_id','owner'],['entity_type','team'],['entity_id',item.entity_id]]);expect(f.query.limit).toHaveBeenCalledWith(1)
 })
 it('uses the existing membership decision for additions and fails closed on reads, access failures and account changes',async()=>{
  const f=fixture(),access=vi.fn().mockResolvedValue(false)
  expect(await directoryFollowStatus(f.client,item,()=>true,access)).toMatchObject({following:false,canAdd:false})
  access.mockRejectedValueOnce(Error('offline'));await expect(directoryFollowStatus(f.client,item,()=>true,access)).rejects.toThrow('offline')
  f.query.abortSignal.mockResolvedValueOnce({data:[{id:''}],error:null});await expect(directoryFollowStatus(f.client,item,()=>true,access)).rejects.toThrow('status unavailable')
  f.query.abortSignal.mockResolvedValueOnce({data:[],error:{message:'denied'}});await expect(directoryFollowStatus(f.client,item,()=>true,access)).rejects.toThrow('status unavailable')
  f.getSession.mockResolvedValueOnce({data:{session:f.session},error:null}).mockResolvedValueOnce({data:{session:{...f.session,user:{id:'changed'}}},error:null});await expect(directoryFollowStatus(f.client,item,()=>true,access)).rejects.toThrow('status unavailable')
 })
 it.each([true,false])('sends one confirmed API change following=%s with no supplied owner',async following=>{
  const f=fixture(),send=vi.fn().mockResolvedValue({status:200,data:{ok:true,following}})
  await saveDirectoryFollow(f.client,item,following,'owner',()=>true,send)
  expect(send).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledWith(expect.objectContaining({url:'https://www.tenaceiq.com/api/follows',method:following?'POST':'DELETE',data:item,disableRedirects:true,headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},connectTimeout:12000,readTimeout:12000}))
 })
 it('rejects stale owners before sending, ignores owner changes afterward and never retries uncertain writes',async()=>{
  const f=fixture(),send=vi.fn().mockResolvedValue({status:200,data:{ok:true,following:true}})
  await expect(saveDirectoryFollow(f.client,item,true,'other',()=>true,send)).rejects.toThrow('Account changed');expect(send).not.toHaveBeenCalled()
  await expect(saveDirectoryFollow(f.client,item,true,'owner',()=>false,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
  f.getSession.mockResolvedValueOnce({data:{session:f.session},error:null}).mockResolvedValueOnce({data:{session:{...f.session,user:{id:'changed'}}},error:null});await expect(saveDirectoryFollow(f.client,item,true,'owner',()=>true,send)).rejects.toThrow('Account changed');expect(send).toHaveBeenCalledOnce()
  send.mockResolvedValue({status:200,data:{ok:true,following:false}});await expect(saveDirectoryFollow(f.client,item,true,'owner',()=>true,send)).rejects.toThrow('Could not confirm');expect(send).toHaveBeenCalledTimes(2)
 })
})
