import {expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {CoachSend} from '../../mobile/src/coach-workspace-data'
import {TacticsLibrary} from '../../mobile/src/coach-tactics-data'
import {createTacticalTemplate} from '../tactical/templates'
import {readTacticalBoard} from '../native-tactics-contract'
const owner='owner',scenario=readTacticalBoard(createTacticalTemplate('coachProgression'))
const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
const reply=(saved:boolean,foreign=false)=>({status:200,headers:{},url:'https://www.tenaceiq.com/api/mobile/coach/tactics',data:{ok:true,owner:foreign?'other':owner,scenarios:[],more:false,detail:saved?{id:scenario.id,scenario,updatedAt:'2026-11-01T00:00:00Z'}:null}})
it('uses bounded owner-checked native transport and does not repeat an uncertain write',async()=>{
 const send=vi.fn<CoachSend>().mockRejectedValueOnce(Error('Lost')).mockResolvedValue(reply(true)),lib=new TacticsLibrary(client,owner,()=>true,send)
 await expect(lib.save({action:'save',scenario,expectedUpdatedAt:null})).rejects.toThrow('Lost');expect(send).toHaveBeenCalledTimes(1)
 await expect(lib.save({action:'save',scenario,expectedUpdatedAt:null})).rejects.toThrow('Check saved boards');expect((await lib.check()).confirmed).toBe(true);expect(lib.pending).toBeNull();expect(send.mock.calls.map(c=>c[0])).toEqual(['POST','GET'])
 expect(send.mock.calls[0][1]).toMatchObject({disableRedirects:true,readTimeout:30000,headers:{Authorization:'Bearer synthetic'}})
})
it('permits an explicit retry only after a read finds the unchanged baseline',async()=>{
 const send=vi.fn<CoachSend>().mockRejectedValueOnce(Error('Lost')).mockResolvedValueOnce(reply(false)).mockResolvedValueOnce(reply(true)),lib=new TacticsLibrary(client,owner,()=>true,send)
 await expect(lib.save({action:'save',scenario,expectedUpdatedAt:null})).rejects.toThrow();expect(()=>lib.retry()).toThrow();expect((await lib.check()).confirmed).toBe(false);expect(lib.canRetry).toBe(true);await lib.retry();expect(lib.pending).toBeNull()
})
it('rejects late and foreign-account responses',async()=>{
 let active=true;const send=vi.fn<CoachSend>().mockImplementation(async()=>{active=false;return reply(false)}),lib=new TacticsLibrary(client,owner,()=>active,send)
 await expect(lib.load()).rejects.toThrow();send.mockResolvedValue(reply(false,true));await expect(new TacticsLibrary(client,owner,()=>true,send).load()).rejects.toThrow()
})
