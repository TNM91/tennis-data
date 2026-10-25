import {describe,expect,it,vi} from 'vitest'
import {createTeamNavigationGuard} from '../../mobile/src/navigation-warning'
const settle=async()=>{await Promise.resolve();await Promise.resolve()}
describe('team navigation and unfinished work',()=>{
 it('navigates immediately without unfinished work',()=>{const action=vi.fn(),confirm=vi.fn();createTeamNavigationGuard(()=>false,()=>1,confirm)(action);expect(action).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled()})
 it('keeps the current view when the player cancels',async()=>{const action=vi.fn();createTeamNavigationGuard(()=>true,()=>1,async()=>false)(action);await settle();expect(action).not.toHaveBeenCalled()})
 it('waits for an explicit leave choice before navigating',async()=>{let answer!:(leave:boolean)=>void;const action=vi.fn();createTeamNavigationGuard(()=>true,()=>1,()=>new Promise(resolve=>{answer=resolve}))(action);expect(action).not.toHaveBeenCalled();answer(true);await settle();expect(action).toHaveBeenCalledOnce()})
 it('ignores a leave choice after the account or screen revision changes',async()=>{let version=1,answer!:(leave:boolean)=>void;const action=vi.fn();createTeamNavigationGuard(()=>true,()=>version,()=>new Promise(resolve=>{answer=resolve}))(action);version++;answer(true);await settle();expect(action).not.toHaveBeenCalled()})
 it('keeps unfinished work if confirmation fails',async()=>{const action=vi.fn();createTeamNavigationGuard(()=>true,()=>1,async()=>{throw Error('dialog unavailable')})(action);await settle();expect(action).not.toHaveBeenCalled()})
})
