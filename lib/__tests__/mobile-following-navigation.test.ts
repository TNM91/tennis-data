import {afterEach,describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const mocks=vi.hoisted(()=>({load:vi.fn(),directory:vi.fn(),player:vi.fn()}))
vi.mock('../../mobile/src/followed-entities',async original=>({...await original<typeof import('../../mobile/src/followed-entities')>(),loadFollowedEntities:mocks.load}))
vi.mock('../../mobile/src/directory-view',()=>({showDirectory:mocks.directory}))
vi.mock('../../mobile/src/explore',()=>({showExplore:mocks.player}))
import {showFollowing} from '../../mobile/src/follows-view'
const saved={entity_type:'team',entity_id:'usta__Aces__City__4.0',entity_name:'Aces',subtitle:'City 4.0'}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
async function fixture(deferred=false){
 let active=true,resolve!:(value:unknown)=>void
 const focus=vi.fn(),body={},tabs=['player','team','league'].map(kind=>({dataset:{followKind:kind},disabled:false,isConnected:true,setAttribute:vi.fn(),focus:vi.fn(),onclick:null as null|(()=>void)})),item={dataset:{followItem:'0'},isConnected:true,focus:vi.fn(),onclick:null as null|(()=>void)}
 const search={value:'',oninput:null as null|(()=>void)},refresh={disabled:false,isConnected:true,focus:vi.fn(),onclick:null as null|(()=>void)},status={textContent:''},rows={innerHTML:'',querySelectorAll:()=>[item],querySelector:()=>item},directoryHost={},returnButton={onclick:null as null|(()=>void)},detail={hidden:true,innerHTML:'',querySelector:(selector:string)=>selector==='[data-back-following]'?returnButton:directoryHost},list={hidden:false,querySelector:(selector:string)=>({'#following-status':status,'#following-rows':rows,'#refresh-following':refresh,'#following-search':search,h1:{focus}}[selector]),querySelectorAll:()=>tabs},app={innerHTML:'',querySelector:(selector:string)=>selector==='#following-list'?list:selector==='#following-player'?detail:{focus}}
 vi.stubGlobal('document',{body,activeElement:body});vi.stubGlobal('window',{scrollY:120,scrollTo:vi.fn()})
 const child={back:vi.fn(()=>false),dispose:vi.fn()};mocks.directory.mockReturnValue(child);mocks.player.mockReturnValue({...child,closeOverlay:()=>false});mocks.load.mockImplementation(async(_client,kind)=>kind==='player'?{rows:[],limited:false}:{rows:[saved],limited:false})
 if(deferred)mocks.load.mockImplementationOnce(()=>new Promise(r=>{resolve=r}))
 const controller=showFollowing(app as unknown as HTMLElement,{} as SupabaseClient,()=>active);await Promise.resolve()
 return {controller,tabs,item,search,refresh,status,rows,list,detail,child,close:()=>{active=false},finish:()=>resolve({rows:[saved],limited:false})}
}
describe('Following category navigation',()=>{
 it('loads only Players initially and reads Teams after an explicit category choice',async()=>{const f=await fixture();expect(mocks.load.mock.calls[0][1]).toBe('player');f.tabs[1].onclick!();await Promise.resolve();expect(mocks.load.mock.calls[1][1]).toBe('team');expect(f.tabs[1].focus).toHaveBeenCalledOnce();expect(f.rows.innerHTML).toContain('Aces')})
 it('opens the recorded team context and returns to the same category and local search',async()=>{const f=await fixture();f.tabs[1].onclick!();await Promise.resolve();f.search.value='city';f.search.oninput!();const reads=mocks.load.mock.calls.length;f.item.onclick!();expect(mocks.directory.mock.calls[0][5]).toMatchObject({team:{name:'Aces',league:'City',flight:'4.0'}});expect(f.controller.back()).toBe(true);await Promise.resolve();await Promise.resolve();expect(f.child.dispose).toHaveBeenCalledOnce();expect(f.search.value).toBe('city');expect(mocks.load.mock.calls[reads][1]).toBe('team');expect(f.item.focus).toHaveBeenCalled()})
 it('filters the loaded sample without another request and retains filters by category',async()=>{const f=await fixture();f.tabs[1].onclick!();await Promise.resolve();const reads=mocks.load.mock.calls.length;f.search.value='missing';f.search.oninput!();expect(f.rows.innerHTML).toContain('No loaded follows match');expect(mocks.load).toHaveBeenCalledTimes(reads);f.tabs[2].onclick!();await Promise.resolve();f.tabs[1].onclick!();await Promise.resolve();expect(f.search.value).toBe('missing')})
 it('prevents duplicate reads while busy and ignores late replies after disposal',async()=>{const f=await fixture(true);f.tabs[1].onclick!();f.refresh.onclick!();expect(mocks.load).toHaveBeenCalledOnce();f.controller.dispose();f.finish();await Promise.resolve();expect(f.rows.innerHTML).toBe('');expect(mocks.directory).not.toHaveBeenCalled()})
 it('does not open retained actions after the visit closes or the button disconnects',async()=>{const f=await fixture();f.tabs[1].onclick!();await Promise.resolve();f.item.isConnected=false;f.item.onclick!();expect(mocks.directory).not.toHaveBeenCalled();f.item.isConnected=true;f.close();f.item.onclick!();expect(mocks.directory).not.toHaveBeenCalled()})
})
