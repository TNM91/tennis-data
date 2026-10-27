import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
const state=vi.hoisted(()=>({valid:true,profileError:false,fail:false,tables:[] as string[],authCalls:0}))
vi.mock('../data-assist-import-runner',()=>({runDataAssistScheduleImportAction:vi.fn(),runDataAssistScorecardImportAction:vi.fn(),runDataAssistTeamSummaryImportAction:vi.fn()}))
vi.mock('../supabase',()=>({supabaseUrl:'https://synthetic.supabase.co',supabaseKey:'public-test-key',supabase:{}}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>{state.authCalls++;if(state.fail)throw Error('private diagnostics');return {data:{user:state.valid?{id:'11111111-1111-4111-8111-111111111111'}:null},error:null}}},from:(table:string)=>{state.tables.push(table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{role:'player'},error:state.profileError?{message:'private diagnostics'}:null})};return q}})}))
import {GET} from '../../app/api/data-assist/ocr/route'
beforeEach(()=>{vi.spyOn(console,'error').mockImplementation(()=>{});state.valid=true;state.profileError=false;state.fail=false;state.tables=[];state.authCalls=0})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()})
const request=(signed=true)=>new Request('https://example.test/api/data-assist/ocr',{headers:signed?{Authorization:'Bearer synthetic-token'}:{}})
describe('authenticated scorecard-photo availability',()=>{
 it('rejects anonymous and invalid sessions without exposing configuration',async()=>{const anon=await GET(request(false));expect(anon.status).toBe(401);expect(state.authCalls).toBe(0);state.valid=false;expect((await GET(request())).status).toBe(401);expect(state.tables).toEqual([])})
 it('returns only the enabled flag, privately uncached, without any OCR job or writes',async()=>{vi.stubEnv('DATA_ASSIST_OCR_PROVIDER','tesseract');const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(await response.json()).toEqual({ok:true,canReadScorecardPhotos:true});expect(state.tables).toEqual(['profiles']);expect(state.authCalls).toBe(1)})
 it('honors disabled reading and keeps dependency failures closed and private',async()=>{vi.stubEnv('DATA_ASSIST_OCR_PROVIDER','disabled');vi.stubEnv('NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER','disabled');expect(await (await GET(request())).json()).toEqual({ok:true,canReadScorecardPhotos:false});state.profileError=true;const failed=await GET(request());expect(failed.status).toBe(500);expect(await failed.json()).toEqual({ok:false});state.fail=true;const unavailable=await GET(request());expect(unavailable.status).toBe(503);expect(unavailable.headers.get('Cache-Control')).toContain('no-store');expect(await unavailable.json()).toEqual({ok:false})})
})
