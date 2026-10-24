import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamConversationMessages} from '../team-room-message-history'
describe('bounded team conversation history',()=>{
 it('selects newest messages within the exact conversation then reverses a copy for display',async()=>{
  const newest=[{id:'new'},{id:'old'}],query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn().mockResolvedValue({data:newest,error:null})}
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query)
  const service={from:vi.fn().mockReturnValue(query)} as unknown as SupabaseClient
  expect((await loadTeamConversationMessages(service,'allowed-room')).data).toEqual([{id:'old'},{id:'new'}]);expect(newest[0].id).toBe('new')
  expect(query.eq).toHaveBeenCalledWith('conversation_id','allowed-room');expect(query.order.mock.calls).toEqual([['created_at',{ascending:false,nullsFirst:false}],['id',{ascending:false}]]);expect(query.limit).toHaveBeenCalledWith(300)
 })
})
