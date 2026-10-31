import {beforeEach, expect, it, vi} from 'vitest'
const state = vi.hoisted(() => ({allowed: 200, client: {} as unknown}))
vi.mock('../coach-api-auth', () => ({getCoachApiAuth: async () => state.allowed === 200 ? {ok: true, supabase: state.client, userId: '11111111-1111-4111-8111-111111111111'} : {ok: false, response: Response.json({ok: false}, {status: state.allowed})}}))
import {GET, POST, PATCH} from '../../app/api/mobile/coach/route'
import {coachOwner, coachRevision, coachStudentDraft, coachAssignmentDraft, coachReviewDraft} from '../../tests/fixtures/native-coach'
type Row = Record<string, unknown>
let tables: Record<string, Row[]>, calls: {table: string; operation: string; filters: [string, unknown][]; payload?: Row}[], race = false, failure = false
function client() {return {from: (table: string) => {
 const call = {table, operation: 'read', filters: [] as [string, unknown][], payload: undefined as Row | undefined}; calls.push(call); let limit = 999
 const run = (single = false) => {
  if (failure) return {data: null, error: {message: 'private database error'}}
  if (call.operation === 'insert') {if (tables[table].some(r => r.id === call.payload!.id)) return {data: null, error: {code: '23505'}}; tables[table].unshift({...call.payload}); return {data: null, error: null}}
  if (race && call.operation === 'update') tables[table][0].updated_at = '2026-10-30T14:00:00Z'
  const rows = tables[table].filter(r => call.filters.every(([key, value]) => r[key] === value)).slice(0, limit)
  if (call.operation === 'update') rows.forEach(r => Object.assign(r, call.payload))
  return {data: single ? rows[0] ?? null : rows, error: null}
 }
 const q = {select: () => q, eq: (k: string, v: unknown) => {call.filters.push([k, v]); return q}, order: () => q, limit: (n: number) => {limit = n; return q}, abortSignal: () => q, insert: (payload: Row) => {call.operation = 'insert'; call.payload = payload; return q}, update: (payload: Row) => {call.operation = 'update'; call.payload = payload; return q}, maybeSingle: async () => run(true), then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve)}
 return q
}}}
const url = 'https://synthetic.invalid/api/mobile/coach'
const request = (method: string, body: unknown) => new Request(url, {method, body: JSON.stringify(body)})
beforeEach(() => {
 state.allowed = 200; calls = []; race = failure = false
 tables = {coach_player_links: [{id: 'student-one', coach_user_id: coachOwner, player_user_id: 'linked-player', player_name: 'Alex Rivera', identity_slug: 'relentless-competitor-4-0', level_label: '4.0', status: 'active', notes: 'Private coach note', updated_at: coachRevision, player_email: 'private@example.test'}, {id: 'foreign', coach_user_id: 'other', player_name: 'Foreign player'}], coach_assignments: [{id: 'assignment-one', coach_user_id: coachOwner, student_link_id: 'student-one', title: 'Return practice', focus: 'Depth', due_date: null, status: 'completed', assignment_json: {futureField: 'keep', playerCheckIn: {recap: 'Four deep returns', evidence: '4/5', completedAt: '2026-10-30T12:00:00Z'}}, updated_at: coachRevision}]}
 state.client = client()
})
it.each([401, 403])('checks existing Coach access before data reads (%s)', async status => {state.allowed = status; for (const method of [GET, POST, PATCH]) {const r = await method(new Request(url)); expect(r.status).toBe(status); expect(r.headers.get('Cache-Control')).toContain('no-store')} expect(calls).toEqual([])})
it('scopes every read to the caller and strips linked account IDs and returns contact details only for the selected owned student', async () => {
 const r = await GET(new Request(url + '?student=student-one')); expect(r.status).toBe(200); const body = await r.text()
 expect(body).toContain('Alex Rivera'); expect(JSON.parse(body).detail.student.email).toBe('private@example.test');expect(JSON.stringify(JSON.parse(body).students)).not.toContain('private@example'); expect(body).not.toContain('linked-player'); expect(body).not.toContain('Foreign player'); expect(body).not.toContain('coach_user_id')
 expect(calls.every(c => c.filters.some(([k, v]) => k === 'coach_user_id' && v === coachOwner))).toBe(true)
 expect((await GET(new Request(url + '?student=foreign'))).status).toBe(404)
})
it('validates input and forbids account injection before writes', async () => {
 for (const suffix of ['?student=x&student=y', '?owner=other', '?student=../bad']) expect((await GET(new Request(url + suffix))).status).toBe(400)
 for (const b of [null, [], {...coachStudentDraft, coachUserId: 'other'}, {...coachAssignmentDraft, status: 'completed'}]) expect((await POST(request('POST', b))).status).toBe(400)
 const oversized = await POST(request('POST', {...coachStudentDraft, notes: '🎾'.repeat(2000)})); expect(oversized.status).toBe(413)
 expect(calls).toEqual([])
})
it('creates a manual roster record with no player link, invitation or overwrite', async () => {
 expect((await POST(request('POST', coachStudentDraft))).status).toBe(200)
 const payload = calls.find(c => c.operation === 'insert')!.payload!
 expect(payload).toMatchObject({coach_user_id: coachOwner, player_user_id: null, setup_status: 'manual', contact_preference: 'in_app', status: 'needs_assignment'})
 expect(calls.some(c => c.table.includes('invite'))).toBe(false)
 expect((await POST(request('POST', coachStudentDraft))).status).toBe(409)
})
it('requires a current owned active student before inserting an assignment', async () => {
 for (const patch of [{student: 'foreign'}, {expectedUpdatedAt: '2026-10-29T00:00:00Z'}]) expect((await POST(request('POST', {...coachAssignmentDraft, ...patch}))).status).toBe(patch.student ? 404 : 409)
 tables.coach_player_links[0].status = 'paused'; expect((await POST(request('POST', coachAssignmentDraft))).status).toBe(409)
 expect(calls.some(c => c.operation === 'insert')).toBe(false)
 tables.coach_player_links[0].status = 'active'; expect((await POST(request('POST', coachAssignmentDraft))).status).toBe(200)
 expect(calls.find(c => c.operation === 'insert')!.payload).toMatchObject({coach_user_id: coachOwner, student_link_id: 'student-one', assignment_json: {detail: coachAssignmentDraft.kind === 'assignment' ? coachAssignmentDraft.instructions : '', expectedEvidence: 'Five patterns'}})
})
it('reviews only an unchanged completed check-in and preserves player proof and future fields', async () => {
 expect((await PATCH(request('PATCH', coachReviewDraft))).status).toBe(200)
 const update = calls.find(c => c.operation === 'update')!
 expect(update.filters).toEqual(expect.arrayContaining([['coach_user_id', coachOwner], ['student_link_id', 'student-one'], ['id', 'assignment-one'], ['updated_at', coachRevision]]))
 expect(update.payload!.assignment_json).toMatchObject({futureField: 'keep', playerCheckIn: {evidence: '4/5'}, coachReview: {note: coachReviewDraft.note, nextFocus: coachReviewDraft.nextFocus}})
 expect(update.payload).not.toHaveProperty('status')
})
it('rejects stale review, missing proof and a concurrent update', async () => {
 expect((await PATCH(request('PATCH', {...coachReviewDraft, expectedUpdatedAt: '2026-10-29T00:00:00Z'}))).status).toBe(409)
 tables.coach_assignments[0].assignment_json = {}; expect((await PATCH(request('PATCH', coachReviewDraft))).status).toBe(409)
 tables.coach_assignments[0].assignment_json = {playerCheckIn: {recap: 'done', completedAt: '2026-10-30T12:00:00Z'}}; race = true
 expect((await PATCH(request('PATCH', coachReviewDraft))).status).toBe(409)
 expect(tables.coach_assignments[0].assignment_json).not.toHaveProperty('coachReview')
})
it('contains backend errors without exposing SQL or private details', async () => {failure = true; const r = await GET(new Request(url)); expect(r.status).toBe(503); expect(await r.text()).not.toContain('private database')})

const editStudent=()=>({kind:'edit-student',id:'student-one',expectedUpdatedAt:coachRevision,name:'Alex Court',level:'4.5',notes:'Work on return height',status:'paused'})
const editAssignment=()=>({kind:'edit-assignment',id:'assignment-one',student:'student-one',expectedUpdatedAt:coachRevision,title:'Updated return practice',focus:'Height',dueDate:'2026-11-07',instructions:'Clear the net by three feet.',evidence:'Five deep returns',status:'completed'})
it('edits only exposed student fields and retains contact, identity and player connection',async()=>{
 const r=await PATCH(request('PATCH',editStudent()));expect(r.status).toBe(200)
 const update=calls.find(c=>c.operation==='update')!
 expect(Object.keys(update.payload!).sort()).toEqual(['level_label','notes','player_name','status','updated_at'])
 expect(update.filters).toEqual(expect.arrayContaining([['coach_user_id',coachOwner],['id','student-one'],['updated_at',coachRevision]]))
 expect(tables.coach_player_links[0]).toMatchObject({player_user_id:'linked-player',player_email:'private@example.test',identity_slug:'relentless-competitor-4-0',status:'paused'})
 expect(Date.parse(String(update.payload!.updated_at))).toBeGreaterThan(Date.parse(coachRevision))
})
it('preserves completed proof, coach feedback, practice packs and unknown assignment fields',async()=>{
 Object.assign(tables.coach_assignments[0].assignment_json as object,{coachReview:{note:'Keep this',nextFocus:'Height'},pack:{id:'pack-one'}})
 expect((await PATCH(request('PATCH',editAssignment()))).status).toBe(200)
 expect(tables.coach_assignments[0]).toMatchObject({status:'completed',assignment_json:{futureField:'keep',playerCheckIn:{evidence:'4/5'},coachReview:{note:'Keep this'},pack:{id:'pack-one'},detail:'Clear the net by three feet.',expectedEvidence:'Five deep returns'}})
 expect(calls.find(c=>c.operation==='update')!.filters).toEqual(expect.arrayContaining([['coach_user_id',coachOwner],['student_link_id','student-one'],['updated_at',coachRevision]]))
})
it('rejects stale or foreign edits and concurrent student or player updates without overwriting them',async()=>{
 for(const draft of [editStudent(),editAssignment()]){
  expect((await PATCH(request('PATCH',{...draft,expectedUpdatedAt:'2020-01-01T00:00:00Z'}))).status).toBe(409)
  race=true;expect((await PATCH(request('PATCH',draft))).status).toBe(409);race=false
  tables.coach_player_links[0].updated_at=coachRevision;tables.coach_assignments[0].updated_at=coachRevision
 }
 expect((await PATCH(request('PATCH',{...editStudent(),id:'foreign'}))).status).toBe(404)
 expect(tables.coach_player_links[0].player_name).toBe('Alex Rivera');expect(tables.coach_assignments[0].title).toBe('Return practice')
})
it('permits publishing a draft for an active student while rejecting reopens and paused publication',async()=>{
 expect((await PATCH(request('PATCH',{...editAssignment(),status:'assigned'}))).status).toBe(409)
 tables.coach_assignments[0].status='draft';tables.coach_player_links[0].status='paused'
 expect((await PATCH(request('PATCH',{...editAssignment(),status:'assigned'}))).status).toBe(409)
 tables.coach_player_links[0].status='active';expect((await PATCH(request('PATCH',{...editAssignment(),status:'assigned'}))).status).toBe(200)
})
it('rejects unsafe edit fields and invalid dates and statuses before reading data',async()=>{
 for(const draft of [{...editStudent(),player_user_id:'other'},{...editStudent(),status:'admin'},{...editAssignment(),dueDate:'2026-02-30'},{...editAssignment(),assignment_json:{}}])expect((await PATCH(request('PATCH',draft))).status).toBe(400)
 expect(calls).toEqual([])
})
