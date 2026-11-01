import {afterEach,expect,it,vi} from 'vitest'
import {createCoachAutoCatchup} from '../../mobile/src/coach-auto-catchup'

afterEach(()=>vi.useRealTimers())
it('coalesces activity without idle polling and waits at least two seconds between starts',async()=>{
 vi.useFakeTimers();const load=vi.fn(async()=>{}),auto=createCoachAutoCatchup(()=>true,load)
 auto.signal('one');auto.signal('two');await vi.advanceTimersByTimeAsync(249);expect(load).not.toHaveBeenCalled()
 await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(1)
 auto.signal('two');await vi.advanceTimersByTimeAsync(10000);expect(load).toHaveBeenCalledTimes(1)
 auto.signal('three');await vi.advanceTimersByTimeAsync(250);expect(load).toHaveBeenCalledTimes(2)
 auto.signal('four');await vi.advanceTimersByTimeAsync(1999);expect(load).toHaveBeenCalledTimes(2)
 await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(3);auto.dispose()
})
it('rechecks eligibility when a timer fires and only restarts after a new eligible signal',async()=>{
 vi.useFakeTimers();let eligible=true;const load=vi.fn(async()=>{}),auto=createCoachAutoCatchup(()=>eligible,load)
 auto.signal('one');eligible=false;await vi.advanceTimersByTimeAsync(5000);expect(load).not.toHaveBeenCalled()
 eligible=true;auto.signal('one');await vi.advanceTimersByTimeAsync(250);expect(load).toHaveBeenCalledTimes(1);auto.dispose()
})
it('keeps only the latest activity during one active read and does not overlap loads',async()=>{
 vi.useFakeTimers();let release=()=>{};const load=vi.fn(()=>new Promise<void>(resolve=>{release=resolve})),auto=createCoachAutoCatchup(()=>true,load)
 auto.signal('one');await vi.advanceTimersByTimeAsync(250);auto.signal('two');auto.signal('three');await vi.advanceTimersByTimeAsync(5000);expect(load).toHaveBeenCalledTimes(1)
 release();await vi.advanceTimersByTimeAsync(250);expect(load).toHaveBeenCalledTimes(2)
 release();await vi.advanceTimersByTimeAsync(10000);expect(load).toHaveBeenCalledTimes(2);auto.dispose()
})
it('requires distinct activity after a failed request, preserving manual recovery',async()=>{
 vi.useFakeTimers();const load=vi.fn(async()=>{throw Error('unavailable')}),auto=createCoachAutoCatchup(()=>true,load)
 auto.signal('one');await vi.advanceTimersByTimeAsync(250);auto.signal('one');await vi.advanceTimersByTimeAsync(10000);expect(load).toHaveBeenCalledTimes(1)
 auto.signal('two');await vi.advanceTimersByTimeAsync(250);expect(load).toHaveBeenCalledTimes(2);auto.dispose()
})
it('drops pending work when counts become unknown, activity is consumed or the view closes',async()=>{
 vi.useFakeTimers();const load=vi.fn(async()=>{}),auto=createCoachAutoCatchup(()=>true,load)
 auto.signal('one');auto.signal(null);await vi.advanceTimersByTimeAsync(5000);expect(load).not.toHaveBeenCalled()
 auto.signal('two');auto.dispose();auto.signal('three');await vi.advanceTimersByTimeAsync(5000);expect(load).not.toHaveBeenCalled()
})
it('does not schedule a follow-up after an in-flight view is disposed',async()=>{
 vi.useFakeTimers();let release=()=>{};const load=vi.fn(()=>new Promise<void>(resolve=>{release=resolve})),auto=createCoachAutoCatchup(()=>true,load)
 auto.signal('one');await vi.advanceTimersByTimeAsync(250);auto.signal('two');auto.dispose();release();await vi.advanceTimersByTimeAsync(10000);expect(load).toHaveBeenCalledTimes(1)
})
it('treats an explicit refresh as the activity attempt and preserves its recovery choice',async()=>{
 vi.useFakeTimers();const load=vi.fn(async()=>{}),auto=createCoachAutoCatchup(()=>true,load)
 auto.signal('one');auto.started('one');auto.signal('one');await vi.advanceTimersByTimeAsync(10000);expect(load).not.toHaveBeenCalled()
 auto.started('two');auto.signal('three');await vi.advanceTimersByTimeAsync(1999);expect(load).not.toHaveBeenCalled()
 await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(1);auto.dispose()
})
