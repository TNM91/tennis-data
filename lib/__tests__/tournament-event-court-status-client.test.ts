import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ error: null as null | { message: string }, args: null as unknown }))
vi.mock('../supabase',()=>({supabase:{rpc:vi.fn(async(name,args)=>{state.args={name,args};return{data:{status:'called'},error:state.error}}),from:vi.fn(()=>({select:()=>({eq:async()=>({data:[],error:state.error})})}))}}))
import {loadEventCourtStatuses,saveEventCourtStatus} from '../tournament-event-court-status-client'
import type {EventDeskMatch} from '../tournament-event-desk'
const match = {divisionId:'division',matchId:'match',sideA:'A',sideB:'B',date:'2026-10-17',time:'17:30',court:'1'} as EventDeskMatch
describe('court calling client',()=>{
 beforeEach(()=>{state.error=null;state.args=null})
 it('sends optimistic version and pairing/slot snapshot through one atomic save',async()=>{
  await saveEventCourtStatus('event',match,'called','version')
  expect(state.args).toEqual({name:'save_tiq_event_court_status',args:{target_event:'event',target_division:'division',target_match:'match',next_status:'called',player_a:'A',player_b:'B',expected_slot:'2026-10-17|17:30|1',expected_version:'version'}})
 })
 it('does not pretend unavailable reads or rejected calls succeeded',async()=>{
  state.error={message:'network error'}
  await expect(loadEventCourtStatuses('event')).rejects.toThrow('unavailable')
  await expect(saveEventCourtStatus('event',match,'called')).rejects.toThrow('could not be saved')
  state.error={message:'Court status changed. Refresh before saving.'}
  await expect(saveEventCourtStatus('event',match,'called')).rejects.toThrow('Court status changed')
 })
})
