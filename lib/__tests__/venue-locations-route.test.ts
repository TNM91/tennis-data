import {beforeEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({playerAuth:vi.fn(),adminAuth:vi.fn()}))
vi.mock('@/lib/player-api-auth',()=>({getSignedInPlayerApiAuth:mocks.playerAuth}))
vi.mock('@/lib/admin-api-auth',()=>({getAdminApiAuth:mocks.adminAuth}))
import {GET,POST} from '../../app/api/player/venue-locations/route'
import {POST as review} from '../../app/api/admin/venue-locations/route'
const request=(body:object)=>new Request('https://example.test/api',{method:'POST',body:JSON.stringify(body)})
describe('venue authorization and confirmation',()=>{
 beforeEach(()=>{vi.resetAllMocks()})
 it('rejects anonymous reads and writes',async()=>{
  mocks.playerAuth.mockResolvedValue({ok:false,response:new Response('Sign in',{status:401})})
  expect((await GET(new Request('https://example.test/api'))).status).toBe(401)
  expect((await POST(request({}))).status).toBe(401)
 })
 it('never lets a normal player approve a shared venue',async()=>{
  mocks.adminAuth.mockResolvedValue({ok:false,response:new Response('Admin required',{status:403})})
  expect((await review(request({approve:true}))).status).toBe(403)
 })
 it('requires a verified official source before admin approval',async()=>{
  const rpc=vi.fn()
  mocks.adminAuth.mockResolvedValue({ok:true,service:{rpc},userId:'admin'})
  expect((await review(request({id:'pref',updatedAt:'2026-09-07',approve:true,sourceUrl:'https://example.org'}))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
 })
 it('keeps shared suggestions pending and private until reviewed',async()=>{
  const single=vi.fn(async()=>({data:{id:'pref'},error:null}))
  const upsert=vi.fn((payload:Record<string,unknown>)=>{void payload;return {select:()=>({single})}})
  mocks.playerAuth.mockResolvedValue({ok:true,userId:'owner',supabase:{from:()=>({upsert})}})
  const response=await POST(request({facilityName:'Example Club',context:'season-A',city:'St. Louis',state:'MO',streetAddress:'100 Main St',shareForReview:true,review_status:'approved',owner_user_id:'someone-else'}))
  expect(response.status).toBe(200)
  expect(upsert.mock.calls[0][0]).toMatchObject({owner_user_id:'owner',review_status:'pending',context_key:'season-A',directory_id:null})
 })
 it('does not allow an unrelated verified club to be substituted',async()=>{
  mocks.playerAuth.mockResolvedValue({ok:true,userId:'owner',supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{name_keys:['different club']},error:null})})})})}})
  expect((await POST(request({facilityName:'Example Club',context:'season-A',directoryId:'other'}))).status).toBe(400)
 })
})
