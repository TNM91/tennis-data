import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { CapacitorHttp } from '@capacitor/core'
import { connectPlayer, findPlayers, playerSearchTerm } from '../../mobile/src/player-connection'
const post = vi.fn<typeof CapacitorHttp.post>()
const clientFor = (userId='me') => ({auth:{getSession:vi.fn().mockResolvedValue({data:{session:{access_token:'test-token',user:{id:userId}}},error:null})}} as unknown as SupabaseClient)
beforeEach(()=>post.mockReset())
describe('native player connection', () => {
  it('bounds explicit searches and treats wildcards as literal name characters', () => {
    expect(playerSearchTerm('  Ana   Martín  ')).toBe('Ana Martín')
    expect(playerSearchTerm('A_%')).toBe('A\\_\\%')
    expect(()=>playerSearchTerm('a')).toThrow()
    expect(()=>playerSearchTerm('x'.repeat(81))).toThrow()
  })
  it('keeps searches read-only, ordered and bounded', async () => {
    const query = {select:vi.fn(),ilike:vi.fn(),order:vi.fn(),limit:vi.fn(),abortSignal:vi.fn().mockResolvedValue({data:[],error:null})}
    for (const key of ['select','ilike','order','limit'] as const) query[key].mockReturnValue(query)
    const client = {from:vi.fn().mockReturnValue(query)} as unknown as SupabaseClient
    expect(await findPlayers(client,'Ana')).toEqual([])
    expect(client.from).toHaveBeenCalledWith('players')
    expect(query.ilike).toHaveBeenCalledWith('name','%Ana%')
    expect(query.limit).toHaveBeenCalledWith(12)
  })
  it('sends only the chosen ID to the fixed HTTPS endpoint without redirects', async () => {
    post.mockResolvedValue({status:200,data:{ok:true,profile:{linked_player_id:'player'}},headers:{},url:'https://www.tenaceiq.com/api/profile/link'})
    await connectPlayer(clientFor(),'player','me',()=>true,post)
    expect(post).toHaveBeenCalledWith(expect.objectContaining({url:'https://www.tenaceiq.com/api/profile/link',disableRedirects:true,data:{linkedPlayerId:'player'},headers:{Authorization:'Bearer test-token','Content-Type':'application/json'}}))
  })
  it('does not save after an account change or a disposed screen', async () => {
    await expect(connectPlayer(clientFor('other'),'player','me',()=>true,post)).rejects.toThrow('Sign in again')
    await expect(connectPlayer(clientFor(),'player','me',()=>false,post)).rejects.toThrow('Sign in again')
    expect(post).not.toHaveBeenCalled()
  })
  it('requires confirmation that the exact selected record was saved', async () => {
    post.mockResolvedValue({status:200,data:{ok:true,profile:{linked_player_id:'other'}},headers:{},url:''})
    await expect(connectPlayer(clientFor(),'player','me',()=>true,post)).rejects.toThrow('Couldn’t confirm')
    post.mockResolvedValue({status:401,data:{},headers:{},url:''})
    await expect(connectPlayer(clientFor(),'player','me',()=>true,post)).rejects.toThrow('Sign in again')
  })
})
