import {afterEach,describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const mocks=vi.hoisted(()=>({status:vi.fn(),save:vi.fn()}))
vi.mock('../../mobile/src/directory-follow-data',()=>({directoryFollowStatus:mocks.status,saveDirectoryFollow:mocks.save}))
import {showDirectoryFollow} from '../../mobile/src/directory-follow-control'
const item={entity_type:'team' as const,entity_id:'usta__Aces__City__4.0',entity_name:'Aces',subtitle:null}
afterEach(()=>{vi.resetAllMocks()})
function fixture(){
 let active=true,markup='',buttons:Record<string,Button>={};type Button={isConnected:boolean;disabled:boolean;focus:ReturnType<typeof vi.fn>;onclick:null|(()=>Promise<void>|void)}
 const host={isConnected:true,get innerHTML(){return markup},set innerHTML(value:string){for(const button of Object.values(buttons))button.isConnected=false;markup=value;buttons={};for(const selector of value.includes('data-save')?['[data-save]',...(value.includes('data-cancel')?['[data-cancel]']:[])]:value.includes('<button')?['button']:[]){buttons[selector]={isConnected:true,disabled:false,focus:vi.fn(),onclick:null}}},querySelector:(selector:string)=>selector==='button'?Object.values(buttons)[0]:buttons[selector]}
 mocks.status.mockResolvedValue({ownerId:'owner',following:false,canAdd:true});mocks.save.mockResolvedValue(undefined)
 const start=()=>showDirectoryFollow(host as unknown as HTMLElement,{} as SupabaseClient,item,()=>active)
 return {host,start,button:(selector='[data-save]')=>buttons[selector],close:()=>{active=false}}
}
async function settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve()}
describe('directory follow interaction',()=>{
 it('loads status before offering a follow and reconciles explicit successful saves',async()=>{
  const f=fixture();f.start();expect(f.host.innerHTML).toContain('Checking follow status');await settle();expect(f.host.innerHTML).toContain('Follow team')
  mocks.status.mockResolvedValue({ownerId:'owner',following:true,canAdd:true});await f.button().onclick!();await settle();expect(mocks.save).toHaveBeenCalledWith(expect.anything(),item,true,'owner',expect.any(Function));expect(f.host.innerHTML).toContain('Unfollow team');expect(f.button().focus).toHaveBeenCalled()
 })
 it('requires confirmation for removal and cancellation sends nothing',async()=>{
  const f=fixture();mocks.status.mockResolvedValue({ownerId:'owner',following:true,canAdd:true});f.start();await settle();await f.button().onclick!();expect(f.host.innerHTML).toContain('Confirm unfollow');f.button('[data-cancel]').onclick!();expect(mocks.save).not.toHaveBeenCalled();await f.button().onclick!();mocks.status.mockResolvedValue({ownerId:'owner',following:false,canAdd:false});await f.button().onclick!();expect(mocks.save.mock.calls[0][2]).toBe(false);expect(f.host.innerHTML).toContain('access')
 })
 it('blocks duplicate saves and stale callbacks from previous rendering',async()=>{
  const f=fixture();f.start();await settle();let finish!:()=>void;mocks.save.mockImplementationOnce(()=>new Promise<void>(r=>{finish=r}));const old=f.button(),pending=old.onclick!();old.onclick!();expect(mocks.save).toHaveBeenCalledOnce();finish();await pending;await settle();old.onclick!();expect(mocks.save).toHaveBeenCalledOnce()
 })
 it('requires status checking after an uncertain response instead of exposing a toggle',async()=>{
  const f=fixture();f.start();await settle();mocks.save.mockRejectedValueOnce(Error('timeout'));await f.button().onclick!();expect(f.host.innerHTML).toContain('Check follow status');expect(f.host.innerHTML).not.toContain('data-save');expect(mocks.save).toHaveBeenCalledOnce();f.button('button').onclick!();await settle();expect(mocks.status).toHaveBeenCalledTimes(2)
 })
 it('discards late status replies and retained actions after the visit closes',async()=>{
  const f=fixture();let finish!:(value:unknown)=>void;mocks.status.mockImplementationOnce(()=>new Promise(r=>{finish=r}));f.start();f.close();finish({ownerId:'owner',following:false,canAdd:true});await settle();expect(f.host.innerHTML).toContain('Checking follow status');expect(f.button()).toBeUndefined()
 })
})

it('withholds actions for membership denial and failed status reads',async()=>{
 const f=fixture();mocks.status.mockResolvedValueOnce({ownerId:'owner',following:false,canAdd:false});f.start();await settle();expect(f.host.innerHTML).toContain('access');expect(f.button()).toBeUndefined()
 const g=fixture();mocks.status.mockRejectedValueOnce(Error('offline'));g.start();await settle();expect(g.host.innerHTML).toContain('Check follow status');expect(mocks.save).not.toHaveBeenCalled()
})
it('ignores disconnected actions and a save result after leaving the detail',async()=>{
 const f=fixture();f.start();await settle();f.host.isConnected=false;await f.button().onclick!();expect(mocks.save).not.toHaveBeenCalled();f.host.isConnected=true
 let finish!:()=>void;mocks.save.mockImplementationOnce(()=>new Promise<void>(r=>{finish=r}));const pending=f.button().onclick!();f.close();const before=f.host.innerHTML;finish();await pending;expect(f.host.innerHTML).toBe(before);expect(mocks.status).toHaveBeenCalledOnce()
})
