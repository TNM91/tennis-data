import {beforeEach,expect,it,vi} from 'vitest'
import {coachDb} from '../../tests/fixtures/coach-db'
import {createTacticalTemplate} from '../tactical/templates'
import {readTacticalBoard,readTacticsIntent} from '../native-tactics-contract'
const auth=vi.hoisted(()=>({status:200,client:{} as unknown}))
vi.mock('../coach-api-auth',()=>({getCoachApiAuth:async()=>auth.status===200?{ok:true,userId:'owner',supabase:auth.client}:{ok:false,response:Response.json({}, {status:auth.status})}}))
import {GET,POST} from '../../app/api/mobile/coach/tactics/route'
let db:ReturnType<typeof coachDb>
const url='https://synthetic.invalid/api/mobile/coach/tactics',stamp='2026-10-31T06:00:00.123456Z'
const board=()=>({...createTacticalTemplate('coachProgression'),id:'board-one'})
const write=(value:unknown)=>POST(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}))
beforeEach(()=>{auth.status=200;db=coachDb({tactical_scenarios:[{id:'board-one',user_id:'owner',name:'First board',focus:'Serve',category:'practice',scenario_json:board(),updated_at:stamp},{id:'foreign',user_id:'other',scenario_json:{...board(),id:'foreign'},updated_at:stamp}]});auth.client=db.client})
it('reuses all existing templates and validates every nested court object',()=>{
 for(const key of ['basicDoubles','poach','australian','crosscourt','coachProgression'] as const)expect(readTacticalBoard(createTacticalTemplate(key)).tokens.length).toBeGreaterThan(0)
 for(const value of [{...board(),tokens:[{...board().tokens[0],x:101}]},{...board(),paths:[{...board().paths[0],from:{x:NaN,y:20}}]},{...board(),zones:Array(33).fill(board().zones[0])},{...board(),tokens:[board().tokens[0],board().tokens[0]]}])expect(()=>readTacticalBoard(value)).toThrow()
 expect(()=>readTacticsIntent({action:'save',scenario:board(),expectedUpdatedAt:null,owner:'other'})).toThrow()
})
it.each([401,403])('authenticates before querying (%s)',async status=>{auth.status=status;expect((await GET(new Request(url))).status).toBe(status);expect((await write({})).status).toBe(status);expect(db.calls).toEqual([])})
it('uses owner filters on every library read and omits foreign records and raw account IDs',async()=>{
 const response=await GET(new Request(url+'?id=board-one'));expect(response.status).toBe(200);const text=await response.text();expect(text).not.toContain('foreign');expect(text).not.toContain('user_id');expect(response.headers.get('cache-control')).toContain('private, no-store');expect(db.calls.every(c=>c.filters.some(([key,value])=>key==='user_id'&&value==='owner'))).toBe(true)
})
it('inserts new boards once and conditionally edits the exact owned revision',async()=>{
 const scenario={...board(),id:'new-board'};expect((await write({action:'save',scenario,expectedUpdatedAt:null})).status).toBe(200);expect((await write({action:'save',scenario,expectedUpdatedAt:null})).status).toBe(409)
 expect((await write({action:'save',scenario:{...board(),name:'Updated'},expectedUpdatedAt:stamp})).status).toBe(200)
 const update=db.calls.find(c=>c.operation==='update')!;expect(update.filters).toEqual(expect.arrayContaining([['user_id','owner','eq'],['id','board-one','eq'],['updated_at',stamp,'eq']]))
 expect(Date.parse(String(update.payload!.updated_at))).toBeGreaterThan(Date.parse(stamp))
})
it('cannot overwrite or delete a newer edit or a foreign board',async()=>{
 db.hooks.beforeWrite=()=>{db.tables.tactical_scenarios[0].updated_at='2030-01-01T00:00:00Z'}
 expect((await write({action:'save',scenario:board(),expectedUpdatedAt:stamp})).status).toBe(409)
 expect((await write({action:'delete',id:'board-one',expectedUpdatedAt:stamp})).status).toBe(409)
 expect((await write({action:'delete',id:'foreign',expectedUpdatedAt:stamp})).status).toBe(409)
 db.hooks.beforeWrite=null;expect((await write({action:'delete',id:'board-one',expectedUpdatedAt:'2030-01-01T00:00:00Z'})).status).toBe(200);expect(db.tables.tactical_scenarios.map(r=>r.id)).toEqual(['foreign'])
})
it('bounds inputs before queries and contains service errors',async()=>{
 for(const suffix of ['?id=a&id=b','?owner=other','?id=../bad'])expect((await GET(new Request(url+suffix))).status).toBe(400)
 expect((await write({action:'save',scenario:{...board(),note:'x'.repeat(200000)},expectedUpdatedAt:null})).status).toBe(400);expect(db.calls).toEqual([])
 db.hooks.fail=true;const r=await GET(new Request(url));expect(r.status).toBe(503);expect(await r.text()).not.toContain('SQL')
})
