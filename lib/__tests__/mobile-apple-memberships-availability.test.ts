import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {createApplePurchases} from '../../mobile/src/apple-purchases'
import {mountAppleMemberships} from '../../mobile/src/apple-memberships'

describe('Apple membership availability',()=>{
 for(const platform of ['ios','web','android'])it(`handles a missing bridge on ${platform} without starting a purchase`,()=>{
  const client={auth:{getSession:vi.fn()}} as unknown as SupabaseClient
  const service=createApplePurchases(client,{platform,available:false})
  const host={hidden:false,innerHTML:'',replaceChildren:vi.fn()}
  const panel=mountAppleMemberships(host as unknown as HTMLElement,client,'owner',()=>true,vi.fn(),service)
  expect(host.hidden).toBe(platform!=='ios')
  if(platform==='ios'){
   expect(host.innerHTML).toContain('Apple membership')
   expect(host.innerHTML).toContain('couldn’t start')
   expect(host.innerHTML).not.toContain('data-apple-buy')
  }else expect(host.innerHTML).toBe('')
  expect(client.auth.getSession).not.toHaveBeenCalled()
  panel.dispose();expect(host.replaceChildren).toHaveBeenCalledOnce()
 })
})
