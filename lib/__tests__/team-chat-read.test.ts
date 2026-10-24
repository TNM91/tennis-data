import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {markTeamChatRead} from '../team-chat-read'
import {chatTimestamp,newerChatTime} from '../../mobile/src/team-chat-read'
const id='1959be10-4557-4a03-87bd-584ba14ff519'
function database(target:unknown){
 const calls:unknown[][]=[],q={select:vi.fn(),eq:vi.fn(),update:vi.fn(),or:vi.fn().mockResolvedValue({error:null}),maybeSingle:vi.fn().mockResolvedValue(target)}
 q.select.mockReturnValue(q);q.eq.mockImplementation((...args)=>{calls.push(args);return q});q.update.mockReturnValue(q)
 return {q,calls,service:{from:vi.fn().mockReturnValue(q)} as unknown as SupabaseClient}
}
describe('chat read checkpoints',()=>{
 it('preserves Postgres microseconds and UTC offset equivalence',()=>{
  expect(newerChatTime('2026-10-24T00:00:00.123456+00:00','2026-10-24T00:00:00.123455Z')).toBe(true)
  expect(chatTimestamp('2026-10-24T00:00:00.123456+00:00')).toBe(chatTimestamp('2026-10-23T19:00:00.123456-05:00'))
  expect(newerChatTime('invalid','')).toBe(false);expect(chatTimestamp('')).toBeNull()
 })
 it('derives the checkpoint from an exact room message and only advances the current member',async()=>{
  const timestamp='2026-10-23T00:00:00.123456+00:00',db=database({data:{created_at:timestamp},error:null})
  expect(await markTeamChatRead(db.service,'owner','room',id)).toMatchObject({ok:true})
  expect(db.calls).toContainEqual(['id',id]);expect(db.calls).toContainEqual(['conversation_id','room']);expect(db.calls).toContainEqual(['profile_id','owner'])
  expect(db.q.update).toHaveBeenCalledWith({last_read_at:timestamp});expect(db.q.or).toHaveBeenCalledWith(`last_read_at.is.null,last_read_at.lt.${timestamp}`)
 })
 it('rejects malformed or absent targets without changing read state',async()=>{
  const db=database({data:null,error:null})
  expect((await markTeamChatRead(db.service,'owner','room','bad')).status).toBe(400);expect(db.q.select).not.toHaveBeenCalled()
  expect((await markTeamChatRead(db.service,'owner','room',id)).status).toBe(404);expect(db.q.update).not.toHaveBeenCalled()
 })
})
