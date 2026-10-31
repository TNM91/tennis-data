import {it,expect,vi} from 'vitest'
const count=vi.hoisted(()=>vi.fn())
vi.mock('../../mobile/src/updates-data',()=>({countUnreadUpdates:count}))
import {createUpdatesCounter} from '../../mobile/src/updates-counter'
it('reads once on account entry, keeps same-account refreshes local and discards late old-account totals',async()=>{
 count.mockReset();const completions:((n:number)=>void)[]=[];count.mockImplementation(()=>new Promise<number>(resolve=>completions.push(resolve)))
 const changed=vi.fn(),h=createUpdatesCounter({} as never,changed)
 h.setOwner('A');h.setOwner('A');expect(count).toHaveBeenCalledTimes(1)
 h.setOwner('B');expect(changed).toHaveBeenLastCalledWith(null);expect(count).toHaveBeenCalledTimes(2)
 completions[0](19);await Promise.resolve();expect(changed).not.toHaveBeenCalledWith(19)
 completions[1](3);await Promise.resolve();expect(changed).toHaveBeenLastCalledWith(3)
 h.clear();expect(changed).toHaveBeenLastCalledWith(null)
})
it('does not let an older count overwrite a newer explicit refresh or invent a zero after failure',async()=>{
 count.mockReset();let old!:(n:number)=>void;count.mockReturnValueOnce(new Promise<number>(r=>{old=r})).mockResolvedValueOnce(4).mockRejectedValueOnce(Error())
 const changed=vi.fn(),h=createUpdatesCounter({} as never,changed);h.setOwner('A');await h.refresh();old(27);await Promise.resolve();expect(changed).not.toHaveBeenCalledWith(27);expect(changed).toHaveBeenLastCalledWith(4)
 await h.refresh();expect(changed).toHaveBeenLastCalledWith(null);expect(changed).not.toHaveBeenCalledWith(0)
})
