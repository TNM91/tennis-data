import {beforeEach,expect,it,vi} from 'vitest'
import {coachDb} from '../../tests/fixtures/coach-db'
import {coachInvitationToken,readCoachConnectionIntent} from '../native-coach-connection-contract'
const auth=vi.hoisted(()=>({allowed:true,client:{} as unknown}))
vi.mock('../mobile-account-auth',async importOriginal=>({...await importOriginal<typeof import('../mobile-account-auth')>(),verifiedAccount:async()=>auth.allowed?{user:{id:'player',email:'player@example.test'}}:null,accountClient:()=>auth.client}))
import {POST} from '../../app/api/mobile/coach/connection/route'
let db:ReturnType<typeof coachDb>
const request=(body:unknown)=>new Request('https://synthetic.invalid/api/mobile/coach/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
const preview=()=>POST(request({action:'preview',token:'invite-token'}))
beforeEach(()=>{auth.allowed=true;vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-key');db=coachDb({coach_student_invites:[{id:'invite',coach_user_id:'coach',student_link_id:'student',invite_token:'invite-token',invite_email:'player@example.test',status:'pending',expires_at:'2030-01-01T00:00:00Z',updated_at:'2026-10-30T12:00:00Z',accepted_by_user_id:null,message:'Bring your return check-in.'}],coach_player_links:[{id:'student',coach_user_id:'coach',player_user_id:null,status:'active',updated_at:'2026-10-30T12:00:00Z',player_name:'Alex Rivera',level_label:'4.0',player_email:'private@example.test'}]});auth.client=db.client})
it('accepts only canonical invitation links or tokens and strict reviewed intents',()=>{
 expect(coachInvitationToken(' https://www.tenaceiq.com/coach/invite/invite-token ')).toBe('invite-token')
 for(const input of ['https://evil.test/coach/invite/token','https://www.tenaceiq.com@evil.test/coach/invite/token','http://tenaceiq.com/coach/invite/token','https://tenaceiq.com/coach/invite/token?secret=1','https://tenaceiq.com/coach/invite/%2Fbad','<img src=x>'])expect(()=>coachInvitationToken(input)).toThrow()
 for(const body of [{action:'accept',token:'invite-token'},{action:'preview',token:'invite-token',owner:'other'},{action:'accept',token:'invite-token',revision:'x'}])expect(()=>readCoachConnectionIntent(body)).toThrow()
})
it('authenticates before reading and validates bounded private JSON before querying',async()=>{
 auth.allowed=false;expect((await preview()).status).toBe(401);expect(db.calls).toEqual([]);auth.allowed=true
 for(const body of [{action:'preview',token:'invite-token',owner:'other'},{action:'preview',token:'x'.repeat(4000)}])expect((await POST(request(body))).status).toBe(400)
 expect(db.calls).toEqual([])
})
it('previews only the named invited email without writes or contact or token disclosure',async()=>{
 const response=await preview();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer')
 const text=await response.text();expect(JSON.parse(text)).toMatchObject({owner:'player',name:'Alex Rivera',state:'ready'});expect(text).not.toMatch(/invite-token|private@example|player@example|coach_user_id|student_link_id/);expect(db.calls.every(c=>c.operation==='read')).toBe(true)
 db.tables.coach_student_invites[0].invite_email='other@example.test';expect((await preview()).status).toBe(403)
 db.tables.coach_student_invites[0].invite_email='';expect((await preview()).status).toBe(409)
})
it('requires a current review before accepting and preserves student details',async()=>{
 const before=await (await preview()).json();db.tables.coach_student_invites[0].message='Changed invitation'
 expect((await POST(request({action:'accept',token:'invite-token',revision:before.revision}))).status).toBe(409);expect(db.calls.some(c=>c.operation==='update')).toBe(false)
 const fresh=await (await preview()).json();const accepted=await POST(request({action:'accept',token:'invite-token',revision:fresh.revision}));expect(accepted.status).toBe(200);expect(await accepted.json()).toMatchObject({state:'connected'})
 expect(db.tables.coach_player_links[0]).toMatchObject({player_user_id:'player',player_name:'Alex Rivera',player_email:'private@example.test'})
 expect(db.calls.filter(c=>c.operation==='update').map(c=>c.table)).toEqual(['coach_student_invites','coach_player_links'])
})
it('recovers a partial acceptance with a fresh read and cannot overwrite a concurrent link or revoke',async()=>{
 const intent={action:'accept',token:'invite-token',revision:(await (await preview()).json()).revision}
 db.hooks.beforeWrite=t=>{if(t==='coach_player_links')db.tables.coach_player_links[0].updated_at='2030-01-01T00:00:00Z'}
 expect((await POST(request(intent))).status).toBe(409)
 db.hooks.beforeWrite=null;const reserved=await (await preview()).json();expect(reserved.state).toBe('reserved')
 expect((await POST(request({...intent,revision:reserved.revision}))).status).toBe(200)
 db.tables.coach_player_links[0].player_user_id='other';expect((await preview()).status).toBe(409)
})
it('contains service errors and missing configuration',async()=>{
 db.hooks.fail=true;const log=vi.spyOn(console,'error').mockImplementation(()=>{});const r=await preview();expect(r.status).toBe(503);expect(await r.text()).not.toContain('SQL');expect(log).toHaveBeenCalledWith('Native Coach connection could not be confirmed');log.mockRestore()
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');expect((await preview()).status).toBe(503)
})
