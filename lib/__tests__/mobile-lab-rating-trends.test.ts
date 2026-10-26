import {beforeEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {mountLabRatingTrends} from '../../mobile/src/lab-rating-trends'
import {showPlayerJourney} from '../../mobile/src/player-journey-view'
vi.mock('../../mobile/src/player-journey-view',()=>({showPlayerJourney:vi.fn()}))
const client={} as SupabaseClient
function fixture(){
 const button={onclick:null as null|(()=>void)}
 const host={isConnected:true,innerHTML:'',classList:{add:vi.fn()},querySelector:()=>button,replaceChildren:vi.fn()}
 const journey={isScorecardOpen:vi.fn(()=>true),closeScorecard:vi.fn(()=>true),dispose:vi.fn()}
 vi.mocked(showPlayerJourney).mockReturnValue(journey)
 return {button,host,journey,mount:(current=()=>true)=>mountLabRatingTrends(host as unknown as HTMLElement,client,'linked-player',current)}
}
beforeEach(()=>vi.clearAllMocks())
it('does not start history until requested and prevents repeat launches in one visit',()=>{
 const f=fixture();f.mount();expect(showPlayerJourney).not.toHaveBeenCalled();f.button.onclick!();f.button.onclick!()
 expect(showPlayerJourney).toHaveBeenCalledTimes(1)
 expect(vi.mocked(showPlayerJourney).mock.calls[0][2]).toBe('linked-player')
 expect(vi.mocked(showPlayerJourney).mock.calls[0][6]).toEqual({expandChart:true})
})
it('rejects disconnected or superseded visits before starting history',()=>{
 const f=fixture();let current=false;f.mount(()=>current);f.button.onclick!();expect(showPlayerJourney).not.toHaveBeenCalled()
 current=true;f.host.isConnected=false;f.button.onclick!();expect(showPlayerJourney).not.toHaveBeenCalled()
})
it('invalidates pending work, closes resources once, and rejects stale clicks on disposal',()=>{
 const f=fixture();const controller=f.mount();const click=f.button.onclick!;click();const valid=vi.mocked(showPlayerJourney).mock.calls[0][3]
 expect(valid()).toBe(true);controller.dispose();controller.dispose();click();expect(valid()).toBe(false)
 expect(f.journey.dispose).toHaveBeenCalledTimes(1);expect(showPlayerJourney).toHaveBeenCalledTimes(1);expect(f.host.replaceChildren).toHaveBeenCalledTimes(1)
})
it('routes an open scorecard back through the existing journey controller',()=>{
 const f=fixture();const controller=f.mount();expect(controller.isScorecardOpen()).toBe(false);expect(controller.back()).toBe(false)
 f.button.onclick!();expect(controller.isScorecardOpen()).toBe(true);expect(controller.back()).toBe(true);expect(f.journey.closeScorecard).toHaveBeenCalledTimes(1)
})
