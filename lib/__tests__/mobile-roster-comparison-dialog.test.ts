import {afterEach,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const mocks=vi.hoisted(()=>({show:vi.fn()}))
vi.mock('../../mobile/src/comparison-view',()=>({showComparison:mocks.show}))
import {openRosterComparison} from '../../mobile/src/roster-player-comparison'
const players=[{id:'a',name:'Alex',location:null,flight:null},{id:'b',name:'Casey',location:null,flight:null}]
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks()})
function fixture(){
 class Node {isConnected=false;innerHTML='';className='';textContent='';type='';onclick:null|(()=>unknown)=null;oncancel:null|((e:{preventDefault:()=>void})=>void)=null;focus=vi.fn();showModal=vi.fn();remove=vi.fn(()=>{this.isConnected=false});setAttribute=vi.fn();append=vi.fn()}
 const previous=new Node();previous.isConnected=true;const nodes:Node[]=[],scrollTo=vi.fn();vi.stubGlobal('HTMLElement',Node);vi.stubGlobal('document',{activeElement:previous,createElement:()=>{const node=new Node();nodes.push(node);return node},body:{append:(node:Node)=>{node.isConnected=true}}});vi.stubGlobal('window',{scrollX:1,scrollY:77,scrollTo})
 const session={user:{id:'owner'}},getSession=vi.fn().mockResolvedValue({data:{session},error:null}),client={auth:{getSession}} as unknown as SupabaseClient,child={back:vi.fn(()=>false),dispose:vi.fn(),isNotebookOpen:()=>false};mocks.show.mockReturnValue(child);let active=true
 return {nodes,previous,scrollTo,session,getSession,client,child,current:()=>active,close:()=>{active=false}}
}
it('opens the existing gated Matchup with exact seeds, local nested matches and dialog scroll context',async()=>{
 const f=fixture(),controller=openRosterComparison(f.client,players,f.current)!;await vi.waitFor(()=>expect(mocks.show).toHaveBeenCalledOnce());expect(mocks.show.mock.calls[0][3]).toEqual({players,localMatches:true,scrollHost:f.nodes[0]});expect(f.getSession).toHaveBeenCalledTimes(2);expect(f.nodes[0].showModal).toHaveBeenCalledOnce();controller.dispose();expect(f.child.dispose).toHaveBeenCalledOnce();expect(f.previous.focus).toHaveBeenCalled();expect(f.scrollTo).toHaveBeenCalledWith(1,77)
})
it('delegates Back through nested views before closing the roster comparison',async()=>{
 const f=fixture(),controller=openRosterComparison(f.client,players,f.current)!;await vi.waitFor(()=>expect(mocks.show).toHaveBeenCalledOnce());f.child.back.mockReturnValueOnce(true);expect(controller.back()).toBe(true);expect(f.nodes[0].remove).not.toHaveBeenCalled();controller.back();expect(f.nodes[0].remove).toHaveBeenCalledOnce();expect(controller.isOpen()).toBe(false)
})
it('does not open a dialog for duplicate identities or a closed visit',()=>{
 const f=fixture();expect(openRosterComparison(f.client,[players[0],players[0]],f.current)).toBeNull();f.close();expect(openRosterComparison(f.client,players,f.current)).toBeNull();expect(f.nodes).toHaveLength(0);expect(f.getSession).not.toHaveBeenCalled()
})
it('withholds late imports after account changes or disposal',async()=>{
 const f=fixture();f.getSession.mockResolvedValueOnce({data:{session:f.session},error:null}).mockResolvedValueOnce({data:{session:{user:{id:'another'}}},error:null});const first=openRosterComparison(f.client,players,f.current)!;await vi.waitFor(()=>expect(f.nodes[1].innerHTML).toContain('Could not open'));expect(mocks.show).not.toHaveBeenCalled();first.dispose()
 let finish!:(value:unknown)=>void;f.getSession.mockImplementationOnce(()=>new Promise(r=>{finish=r}));const next=openRosterComparison(f.client,players,f.current)!;next.dispose();finish({data:{session:f.session},error:null});await Promise.resolve();await Promise.resolve();expect(mocks.show).not.toHaveBeenCalled()
})
