import {test as base,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {growthServer,growthPlayer,growthPeer,growthId,type GrowthRequest} from '../fixtures/tiq-growth-server'
import type {CoachAssessment} from '../../lib/native-coach-assessment-contract'
const origin='http://127.0.0.1:4286'
let javascript='',stylesheet='',shell=''
type Server=Awaited<ReturnType<typeof growthServer>>
const test=base.extend<{server:Server}>({server:async({},provide)=>{const server=await growthServer();try{await provide(server)}finally{await server.close()}}})
test.describe.configure({retries:0,timeout:45000})
test.beforeAll(async()=>{
  const bundle=await build({entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,jsx:'automatic',define:{TIQ_FIRST_PARTY_BUILD:'true'},loader:{'.module.css':'local-css'},alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},plugins:[{name:'growth-preview',setup(builder){builder.onResolve({filter:/^@capacitor\/app$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-app.ts')}));builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-client.ts')}))}}]})
  javascript=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text
  stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(file=>file==='app.css'?Promise.resolve(bundle.outputFiles.find(f=>f.path.endsWith('.css'))!.text):readFile('mobile/bundled/'+file,'utf8')))).join('\n')
  shell=await readFile('mobile/bundled/index.html','utf8')
})
test.beforeEach(async({page,server})=>{
  await page.exposeFunction('tiqGrowthServer',(r:GrowthRequest)=>server.request(r))
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin)return route.abort()
    if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:javascript})
    if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:url.pathname==='/style.css'?stylesheet+(url.searchParams.has('large')?'\n:root{font-size:22px!important}':''):''})
    if(url.pathname.startsWith('/brand/')||url.pathname==='/logo.png')return route.fulfill({contentType:'image/png',body:await readFile('mobile/bundled'+url.pathname)})
    return route.fulfill({contentType:'text/html',body:url.searchParams.has('large')?shell.replace('./style.css','./style.css?large=1'):shell})
  })
})
async function open(page:Page,large=false){await page.goto(origin+'/?tiq-growth=1&unlinked=1'+(large?'&large=1':''));await expect(page.locator('.lab-starter-tiq')).toBeVisible()}
async function plan(page:Page){await page.getByRole('button',{name:'My improvement plan',exact:true}).click();const d=page.getByRole('dialog',{name:'My improvement plan',exact:true});await expect(d.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled();return d}
async function create(page:Page,sessions=3,target='7 of 10 second serves in'){const d=await plan(page);await d.getByRole('button',{name:'Create improvement plan',exact:true}).click();await d.getByLabel('Measurable target').fill(target);await d.getByLabel('Practices',{exact:true}).fill(String(sessions));await d.getByRole('button',{name:'Review plan',exact:true}).click();await d.getByRole('button',{name:'Save improvement plan',exact:true}).click();await expect(d.getByRole('button',{name:'Review practice log',exact:true})).toBeEnabled();return d}
async function workspace(page:Page){await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination=coach]').click();await page.getByRole('button',{name:'For coaches',exact:true}).click();await page.locator('[data-app-destination=coach-workspace]').click();return page.getByRole('dialog',{name:'Coach workspace',exact:true})}
async function alignment(page:Page){const w=await workspace(page);await w.getByRole('button',{name:/Alex Rivera/}).last().click();await w.getByRole('button',{name:'Coach assessments',exact:true}).click();await page.getByRole('button',{name:'Player & coach view',exact:true}).click();const d=page.getByRole('dialog',{name:'Player and coach view',exact:true});await expect(d.getByLabel('Player self-assessment')).toBeEnabled();return d}
async function coachedPlan(page:Page,server:Server,notes=['Private practice note','8/10 second serves in'],large=false){
  const review=new Date(server.day+'T12:00:00Z');review.setUTCDate(review.getUTCDate()+7)
  const block={version:1,skill:'serve',target:'8 of 10 second serves in',sessions:3,reviewDate:review.toISOString().slice(0,10)},id=growthId(100)
  await server.db.query("insert into coach_assignments values('practice-block',$1,'student-one','Serve practice block','Second serve',$2,'assigned',$3,now())",[growthPlayer,block.reviewDate,JSON.stringify({tiqGrowth:block,cardId:'serve-target-call'})])
  const write=async(change:unknown)=>expect((await server.db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[growthPeer,JSON.stringify(change)])).rows[0].s).toBe(200)
  await write({kind:'new',id,operation:growthId(101),expected:null,baseline:growthId(2),sourceAssignment:'practice-block',block})
  for(const [index,note] of notes.entries()){
    const revision=(await server.db.query<{payload:{revision:string}}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows[0].payload.revision
    await write({kind:'log',id,operation:growthId(110+index),expected:revision,session:{id:growthId(120+index),date:server.day,note}})
  }
  await open(page,large);await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner())
  return plan(page)
}
async function reviewedCoachPlan(page:Page,server:Server,cue='8 of 10 second serves in under pressure',large=false){
  const p=await coachedPlan(page,server,undefined,large)
  await server.assess(growthPeer,240,{serve:3})
  const row=(await server.db.query<{payload:{id:string;revision:string}}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows[0].payload
  expect((await server.db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[growthPeer,JSON.stringify({kind:'review',id:row.id,expected:row.revision,operation:growthId(241),assessment:growthId(240)})])).rows[0].s).toBe(200)
  await server.db.query("update coach_assignments set status='completed',assignment_json=assignment_json||$1::jsonb",[JSON.stringify({playerCheckIn:{recap:'Two practices completed.',evidence:'8/10 serves in.',completedAt:new Date().toISOString()},coachReview:{note:'Keep the finish smooth.',nextFocus:cue,reviewedAt:new Date().toISOString()}})])
  await p.getByRole('button',{name:'Refresh plan',exact:true}).click();await expect(p.getByRole('button',{name:'Plan next practice',exact:true})).toBeEnabled()
  const original=(await server.db.query<{payload:Record<string,unknown>}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows[0].payload
  return {p,original,cue}
}
test.describe('assessment choices',()=>{
  test.use({timezoneId:'Pacific/Kiritimati'})
  for(const width of [320,390]){
    test('keeps same-day baseline and review choices distinct without changing selected records at '+width+'px',async({page,server},info)=>{
      await page.setViewportSize({width,height:844});await server.assess(growthPlayer,11);await server.assess(growthPlayer,12)
      await open(page,width===320);const p=await plan(page);await p.getByRole('button',{name:'Create improvement plan',exact:true}).click()
      const baseline=p.getByLabel('Starting assessment');await expect(baseline.locator('option')).toHaveCount(3)
      const labels=await baseline.locator('option').allTextContents();expect(new Set(labels).size).toBe(3);expect(labels.every(label=>label.endsWith('TiQ 6/10'))).toBe(true)
      const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(server.day+'T12:00:00Z'))
      expect(labels.every(label=>label.startsWith(date))).toBe(true)
      await expect(baseline.locator('option:checked')).toContainText('3 of 3');await baseline.selectOption(growthId(1))
      await p.screenshot({path:info.outputPath('same-day-baseline.png')})
      await p.getByLabel('Measurable target').fill('7 of 10 second serves in');await p.getByRole('button',{name:'Review plan',exact:true}).click();await p.getByRole('button',{name:'Save improvement plan',exact:true}).click()
      const payload=async()=>(await server.db.query<{payload:{baseline:string;assessment:string|null}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows[0].payload
      expect((await payload()).baseline).toBe(growthId(1))
      await server.assess(growthPlayer,30);await server.assess(growthPlayer,31);await p.getByRole('button',{name:'Refresh plan',exact:true}).click()
      const review=p.getByLabel('New self-assessment');await expect(review.locator('option')).toHaveCount(3)
      await expect(review.locator(`option[value="${growthId(30)}"]`)).toContainText('4 of 5');await expect(review.locator(`option[value="${growthId(31)}"]`)).toContainText('5 of 5')
      await review.selectOption(growthId(30));await p.screenshot({path:info.outputPath('same-day-review-choice.png')});await p.getByRole('button',{name:'Review completed plan',exact:true}).click();await p.getByRole('button',{name:'Confirm review',exact:true}).click();await expect(p).toContainText('Reviewed plan')
      expect(await payload()).toMatchObject({baseline:growthId(1),assessment:growthId(30)})
      expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await p.screenshot({path:info.outputPath('same-day-plan-review.png')})
    })
    test('distinguishes shared same-day assessments and keeps private records out of coach choices at '+width+'px',async({page,server},info)=>{
      await page.setViewportSize({width,height:844});await server.assess(growthPeer,22)
      await server.db.query('select write_native_tiq_assessment($1,$2)',[growthPeer,JSON.stringify({kind:'share',id:growthId(22),student:'student-one',linkUpdatedAt:'2026-11-20T12:00:00.000Z',operation:growthId(202),expected:null})])
      await server.assess(growthPeer,23,{serve:3});await open(page,width===320);const d=await alignment(page),self=d.getByLabel('Player self-assessment')
      await expect(self.locator('option')).toHaveCount(3);await expect(self.locator(`option[value="${growthId(23)}"]`)).toHaveCount(0)
      await expect(self.locator('option:checked')).toContainText('2 of 2 · TiQ 6/10');await self.selectOption(growthId(2))
      await expect(self).toHaveValue(growthId(2));await expect(self.locator('option:checked')).toContainText('1 of 2 · TiQ 6/10');await expect(d.locator('.tiq-alignment-context')).toContainText('Saved')
      expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
      expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await d.screenshot({path:info.outputPath('same-day-shared-assessments.png')})
    })
  }
})

function coachObservation(id:number,createdAt:string,focus:CoachAssessment['observation']['focus']='serve'):CoachAssessment{
  return {id:growthId(id),coach:'Morgan Courts',createdAt,observation:{context:'drill',skills:{serve:3,return:1,rally:2},focus,note:'Court observation '+id}}
}
function coachObservations(server:Server,rows:CoachAssessment[]){
  const original=server.request;let reads=0
  server.request=async request=>{
    const response=await original(request)
    if(request.method==='GET'&&new URL(request.url).pathname==='/api/mobile/coach/assessments'&&response.status===200){reads++;return {...response,body:{...(response.body as Record<string,unknown>),assessments:rows}}}
    return response
  }
  return {get reads(){return reads}}
}
async function playerAlignment(page:Page){
  await page.locator('.lab-starter-tiq').getByRole('button',{name:'Coach assessments',exact:true}).click()
  await page.getByRole('dialog',{name:'Coach assessments',exact:true}).getByRole('button',{name:'Player & coach view',exact:true}).click()
  const d=page.getByRole('dialog',{name:'Player and coach view',exact:true});await expect(d.getByLabel('Player self-assessment')).toBeEnabled();return d
}
test('coach observation choices distinguish two same-day observations before planning practice',async({page,server})=>{
  const earlier=coachObservation(81,'2026-11-20T12:00:00.000001Z','return'),later=coachObservation(82,'2026-11-20T12:00:00.000002Z')
  coachObservations(server,[later,earlier]);await open(page);const d=await alignment(page),select=d.getByLabel('Coach observation')
  const first=await select.locator('option[value="'+earlier.id+'"]').textContent(),second=await select.locator('option[value="'+later.id+'"]').textContent()
  expect(first).not.toBe(second)
  await expect(select.locator('option[value="'+earlier.id+'"]')).toContainText('1 of 2');await expect(select.locator('option:checked')).toContainText('2 of 2')
  await select.selectOption(earlier.id);await expect(d.locator('.tiq-alignment-context')).toContainText('1 of 2')
  await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await expect(d.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('return')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

test.describe('coach observation local dates',()=>{
  test.use({timezoneId:'Pacific/Kiritimati'})
  for(const width of [320,390])test('coach observation choices use the local day and readable selected details at '+width+'px',async({page,server},info)=>{
    const previous=coachObservation(80,'2026-11-19T09:59:59.999999Z'),earlier=coachObservation(81,'2026-11-19T10:00:00.000001Z','return'),later=coachObservation(82,'2026-11-19T10:00:00.000002Z')
    coachObservations(server,[later,earlier,previous]);await page.setViewportSize({width,height:844});await open(page,width===320);const d=await alignment(page),select=d.getByLabel('Coach observation')
    await expect(select.locator('option[value="'+previous.id+'"]')).not.toContainText('of ')
    await expect(select.locator('option[value="'+earlier.id+'"]')).toContainText('Nov 20, 2026 · 1 of 2')
    await select.selectOption(earlier.id);await expect(select).toHaveAttribute('aria-describedby','tiq-alignment-coach-context')
    const selected=d.locator('#tiq-alignment-coach-context');await expect(selected).toContainText('Nov 20, 2026 · 1 of 2 · Morgan Courts · On-court drill');await expect(selected).toContainText('Recorded')
    await expect(d.getByLabel('Player self-assessment')).toHaveAttribute('aria-describedby','tiq-alignment-player-context')
    expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
    await expect(selected).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
    await selected.scrollIntoViewIfNeeded()
    await d.screenshot({path:info.outputPath('coach-observation-choices-'+width+'.png')})
    await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await expect(d.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('return')
    expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
  })
})

for(const role of ['coach','player'] as const)test('coach observation choices describe a lone selection without implying a comparison for '+role,async({page,server})=>{
  const earlier=coachObservation(81,'2026-11-20T12:00:00Z','return'),later=coachObservation(82,'2026-11-20T12:01:00Z')
  coachObservations(server,[later,earlier]);await open(page);const d=role==='coach'?await alignment(page):await playerAlignment(page),self=d.getByLabel('Player self-assessment'),coach=d.getByLabel('Coach observation')
  await self.selectOption('');await coach.selectOption(earlier.id)
  await expect(d.getByRole('table')).toHaveCount(0);await expect(d.locator('#tiq-alignment-player-context')).toHaveCount(0)
  await expect(d.locator('#tiq-alignment-coach-context')).toContainText('1 of 2');await expect(coach).toHaveAttribute('aria-describedby','tiq-alignment-coach-context')
  await coach.selectOption('');await expect(d.locator('.tiq-alignment-context')).toHaveCount(0);await expect(coach).not.toHaveAttribute('aria-describedby',/./)
  const id=role==='coach'?growthId(2):growthId(1);await self.selectOption(id)
  await expect(d.locator('#tiq-alignment-player-context')).toContainText('Player:');await expect(d.locator('#tiq-alignment-coach-context')).toHaveCount(0);await expect(d.getByRole('table')).toHaveCount(0)
  if(role==='player')await expect(d.getByRole('button',{name:'Plan practice block',exact:true})).toHaveCount(0)
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

test('coach observation choices keep the exact selected record through refreshed order and new observations',async({page,server})=>{
  const earlier=coachObservation(81,'2026-11-20T12:00:00Z','return'),later=coachObservation(82,'2026-11-20T12:01:00Z'),rows=[later,earlier]
  coachObservations(server,rows);await open(page);const d=await alignment(page),select=d.getByLabel('Coach observation')
  await select.selectOption(earlier.id)
  rows.unshift(coachObservation(83,'2026-11-20T12:02:00Z'));rows.push(coachObservation(80,'2026-11-20T11:59:00Z'))
  await d.getByRole('button',{name:'Refresh shared assessments',exact:true}).click();await expect(select).toBeEnabled();await expect(select).toHaveValue(earlier.id)
  await expect(d.locator('#tiq-alignment-coach-context')).toContainText('2 of 4');await expect(d).toContainText('Court observation 81');await expect(d).not.toContainText('Court observation 83')
  await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await expect(d.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('return')
  await d.getByRole('button',{name:'Review practice block',exact:true}).click();await d.getByRole('button',{name:'Assign practice block',exact:true}).click()
  await expect(d).toContainText('Practice block assigned.')
  const assignments=(await server.db.query<{focus:string;assignment_json:{tiqGrowth:{skill:string}}}>('select focus,assignment_json from coach_assignments')).rows
  expect(assignments).toHaveLength(1);expect(assignments[0].assignment_json.tiqGrowth.skill).toBe('return')
})

test('coach observation choices stay selected when loading earlier self-assessments without another observation read',async({page,server})=>{
  for(let n=20;n<46;n++)await server.assess(growthPlayer,n)
  const earlier=coachObservation(81,'2026-11-20T12:00:00Z','return'),later=coachObservation(82,'2026-11-20T12:01:00Z'),counter=coachObservations(server,[later,earlier])
  await open(page);const d=await playerAlignment(page),select=d.getByLabel('Coach observation');await select.selectOption(earlier.id)
  const label=await select.locator('option:checked').textContent(),reads=counter.reads
  await expect(d.getByLabel('Player self-assessment').locator('option')).toHaveCount(26)
  await d.getByRole('button',{name:'Load earlier self-assessments',exact:true}).click();await expect(d.getByLabel('Player self-assessment').locator('option')).toHaveCount(28)
  await expect(select).toHaveValue(earlier.id);await expect(select.locator('option:checked')).toHaveText(label!);await expect(d.locator('#tiq-alignment-coach-context')).toContainText('1 of 2');expect(counter.reads).toBe(reads)
})

test('coach observation choices clear revoked details and recover only records still available',async({page,server})=>{
  const earlier=coachObservation(81,'2026-11-20T12:00:00Z','return'),later=coachObservation(82,'2026-11-20T12:01:00Z'),rows=[later,earlier]
  coachObservations(server,rows);await open(page);const d=await alignment(page);await d.getByLabel('Coach observation').selectOption(earlier.id)
  server.revoked=true;await d.getByRole('button',{name:'Refresh shared assessments',exact:true}).click();await expect(d).toContainText('couldn’t load')
  await expect(d.locator('.tiq-alignment-context')).toHaveCount(0);await expect(d.getByRole('table')).toHaveCount(0);await expect(d).not.toContainText('Court observation 81')
  server.revoked=false;rows.splice(1,1);await d.getByRole('button',{name:'Refresh shared assessments',exact:true}).click()
  await expect(d.getByLabel('Coach observation')).toHaveValue(later.id);await expect(d.locator('#tiq-alignment-coach-context')).not.toContainText('of ');await expect(d).not.toContainText('Court observation 81')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

test('coach observation choices ignore a late refresh after the account changes',async({page,server})=>{
  const rows=[coachObservation(81,'2026-11-20T12:00:00Z')];coachObservations(server,rows)
  await open(page);const d=await alignment(page),original=server.request;let held=false,release:()=>void=()=>{}
  const receipt=new Promise<void>(resolve=>{release=resolve})
  server.request=async request=>{const response=await original(request);if(request.method==='GET'&&new URL(request.url).pathname==='/api/mobile/coach/assessments'){held=true;await receipt}return response}
  await d.getByRole('button',{name:'Refresh shared assessments',exact:true}).click();await expect.poll(()=>held).toBe(true)
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());release()
  await expect(d).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Court observation 81');await expect(page.locator('body')).toHaveAttribute('data-screen','lab')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

for(const width of [320,390])test('coach practice draft keeps incomplete fields and returns focus at '+width+'px',async({page,server},info)=>{
  await page.setViewportSize({width,height:844});await open(page,width===320);const d=await alignment(page)
  await d.getByRole('button',{name:'Plan practice block',exact:true}).click()
  const target=d.getByRole('textbox',{name:'Measurable target',exact:true}),count=d.getByLabel('Practices',{exact:true}),date=d.getByLabel('Review date',{exact:true})
  const raw='  Keep the second serve deep.\nAim for 8 of 10.  '
  await target.fill(raw);await count.fill('');await date.fill('');await count.focus()
  await d.getByRole('button',{name:'Close',exact:true}).click();await d.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(count).toHaveValue('');await expect(date).toHaveValue('');await expect(target).toHaveValue(raw);await expect(count).toBeFocused()
  await target.focus();await target.press('Escape');await d.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(target).toBeFocused();await expect(target).toBeInViewport();await expect(target).toHaveValue(raw)
  await date.focus();await date.press('Escape');await d.getByRole('button',{name:'Close',exact:true}).click()
  await expect(date).toBeFocused();await expect(date).toHaveValue('');await expect(count).toHaveValue('')
  expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await d.screenshot({path:info.outputPath('coach-practice-draft-'+width+'.png')})
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

test('coach practice draft returns from review to the exact editable fields before one explicit assignment',async({page,server})=>{
  await open(page);const d=await alignment(page);await d.getByRole('button',{name:'Plan practice block',exact:true}).click()
  await d.getByRole('combobox',{name:'Skill',exact:true}).selectOption('return')
  const target=d.getByRole('textbox',{name:'Measurable target',exact:true}),raw='  Return 7 of 10 second serves deep.  '
  await target.fill(raw);await d.getByLabel('Practices',{exact:true}).fill('5');await target.focus()
  await d.getByRole('button',{name:'Review practice block',exact:true}).click()
  await d.getByRole('button',{name:'Close',exact:true}).click();await d.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(d.getByRole('button',{name:'Assign practice block',exact:true})).toBeFocused()
  await d.getByRole('button',{name:'Back',exact:true}).click();await expect(target).toHaveValue(raw);await expect(target).toBeFocused()
  await expect(d.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('return');await expect(d.getByLabel('Practices',{exact:true})).toHaveValue('5')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
  await d.getByRole('button',{name:'Review practice block',exact:true}).click();await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d).toContainText('Practice block assigned.')
  const rows=(await server.db.query<{assignment_json:{tiqGrowth:{skill:string;target:string;sessions:number}}}>('select assignment_json from coach_assignments')).rows
  expect(rows).toHaveLength(1);expect(rows[0].assignment_json.tiqGrowth).toMatchObject({skill:'return',target:raw.trim(),sessions:5})
})

test('coach practice draft keeps an unconfirmed assignment intact without posting when staying',async({page,server})=>{
  await open(page);const d=await alignment(page);await d.getByRole('button',{name:'Plan practice block',exact:true}).click()
  await d.getByRole('textbox',{name:'Measurable target',exact:true}).fill('Make 8 of 10 second serves.')
  await d.getByRole('button',{name:'Review practice block',exact:true}).click()
  const original=server.request,writes:unknown[]=[];let hideReply=true
  server.request=async request=>{
    const response=await original(request)
    if(new URL(request.url).pathname==='/api/mobile/coach'){
      if(request.method==='POST')writes.push(request.write)
      if(hideReply)return {...response,status:503,body:{ok:false}}
    }
    return response
  }
  await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d.getByRole('button',{name:'Retry same practice block',exact:true})).toBeEnabled()
  expect(writes).toHaveLength(1);await expect(d.getByRole('button',{name:'Back',exact:true})).toBeDisabled()
  await d.getByRole('button',{name:'Close',exact:true}).click();await d.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(d.getByRole('button',{name:'Retry same practice block',exact:true})).toBeFocused();expect(writes).toHaveLength(1)
  hideReply=false;await d.getByRole('button',{name:'Retry same practice block',exact:true}).click();await expect(d).toContainText('Practice block assigned.')
  expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(1)
})

test('coach practice draft discards only its fields and returns to the selected observation',async({page,server})=>{
  const earlier=coachObservation(81,'2026-11-20T12:00:00Z','return'),later=coachObservation(82,'2026-11-20T12:01:00Z');coachObservations(server,[later,earlier])
  await open(page);const d=await alignment(page);await d.getByLabel('Coach observation').selectOption(earlier.id)
  await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await d.getByRole('textbox',{name:'Measurable target',exact:true}).fill('Unsent coach target');await d.getByLabel('Practices',{exact:true}).fill('')
  await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('button',{name:'Discard edits',exact:true}).click()
  await expect(d.getByLabel('Coach observation')).toHaveValue(earlier.id);await expect(d.getByRole('button',{name:'Plan practice block',exact:true})).toBeFocused()
  await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await expect(d.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('return');await expect(d.getByLabel('Practices',{exact:true})).toHaveValue('3');await expect(d.getByRole('textbox',{name:'Measurable target',exact:true})).not.toHaveValue('Unsent coach target')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

test('coach practice draft clears private fields and invalidates old warning actions on account change',async({page,server})=>{
  await open(page);const d=await alignment(page);await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await d.getByRole('textbox',{name:'Measurable target',exact:true}).fill('Private unsent coach target')
  await d.getByRole('button',{name:'Close',exact:true}).click()
  await d.evaluate(el=>{(window as unknown as {oldCoachDraftActions:HTMLElement[]}).oldCoachDraftActions=[...el.querySelectorAll<HTMLElement>('[data-keep],[data-discard]')]})
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());await expect(d).toHaveCount(0)
  await page.evaluate(()=>{for(const action of (window as unknown as {oldCoachDraftActions:HTMLElement[]}).oldCoachDraftActions)action.click()})
  await expect(d).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Private unsent coach target');await expect(page.locator('body')).toHaveAttribute('data-screen','lab')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

test('coach practice draft returns an untouched block to its comparison without a warning',async({page,server})=>{
  await open(page);const d=await alignment(page);await d.getByRole('button',{name:'Plan practice block',exact:true}).click();await d.getByRole('button',{name:'Back',exact:true}).click()
  await expect(d.getByLabel('Coach observation')).toBeEnabled();await expect(d.getByRole('button',{name:'Keep editing',exact:true})).toHaveCount(0);await expect(d.getByRole('button',{name:'Plan practice block',exact:true})).toBeFocused()
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
})

async function reviewCoachBlock(page:Page,target='Make 8 of 10 second serves.'){
  await open(page);const d=await alignment(page);await d.getByRole('button',{name:'Plan practice block',exact:true}).click()
  await d.getByRole('textbox',{name:'Measurable target',exact:true}).fill(target);await d.getByRole('button',{name:'Review practice block',exact:true}).click();return d
}

test.describe('coach practice receipt local dates',()=>{
  test.use({timezoneId:'Pacific/Kiritimati'})
  for(const width of [320,390])test('coach practice receipt shows the confirmed block and returns to its selected observation at '+width+'px',async({page,server},info)=>{
    const earlier=coachObservation(81,'2026-11-20T12:00:00Z','return'),later=coachObservation(82,'2026-11-20T12:01:00Z');coachObservations(server,[later,earlier])
    await page.setViewportSize({width,height:844});await open(page,width===320);const d=await alignment(page);await d.getByLabel('Coach observation').selectOption(earlier.id)
    await d.getByRole('button',{name:'Plan practice block',exact:true}).click()
    const target='Return 8 of 10 second serves. Keep <the finish> high.',sessions=width===320?1:4
    await d.getByRole('textbox',{name:'Measurable target',exact:true}).fill(target);await d.getByLabel('Practices',{exact:true}).fill(String(sessions));await d.getByLabel('Review date',{exact:true}).fill('2026-12-06')
    await d.getByRole('button',{name:'Review practice block',exact:true}).click();await expect(d).toContainText(width===320?'1 practice · Review':'4 practices · Review');await expect(d).not.toContainText('1 practices');await d.getByRole('button',{name:'Assign practice block',exact:true}).click()
    const receipt=d.getByRole('region',{name:'Assigned practice block',exact:true});await expect(receipt).toBeVisible();await expect(d.getByRole('heading',{name:'Practice block assigned',exact:true})).toBeFocused()
    await expect(receipt).toContainText('Return practice block');await expect(receipt).toContainText(target);await expect(receipt).toContainText(width===320?'1 practice · Review':'4 practices · Review');await expect(receipt).not.toContainText('1 practices');await expect(receipt.locator('time')).toHaveAttribute('datetime','2026-12-06');await expect(receipt.locator('time')).toContainText('December 6, 2026')
    await expect(receipt).toContainText('Alex Rivera');await expect(receipt).toContainText('My Lab → My improvement plan → Coach practice blocks');await expect(receipt.locator('the')).toHaveCount(0)
    await expect(d.getByRole('button',{name:'Assign practice block',exact:true})).toHaveCount(0);await expect(d.getByRole('table')).toHaveCount(0)
    expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await receipt.scrollIntoViewIfNeeded();await d.screenshot({path:info.outputPath('coach-practice-receipt-'+width+'.png')})
    await d.getByRole('button',{name:'Back to comparison',exact:true}).click();await expect(d.getByLabel('Coach observation')).toHaveValue(earlier.id);await expect(d.getByRole('button',{name:'Plan practice block',exact:true})).toBeFocused();await expect(receipt).toHaveCount(0)
    const rows=(await server.db.query<{assignment_json:{tiqGrowth:{target:string;sessions:number;reviewDate:string}}}>('select assignment_json from coach_assignments')).rows
    expect(rows).toHaveLength(1);expect(rows[0].assignment_json.tiqGrowth).toMatchObject({target,sessions,reviewDate:'2026-12-06'})
  })
})

test('coach practice receipt finishes into the coach workspace with the saved assignment',async({page,server})=>{
  const d=await reviewCoachBlock(page);await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d.getByRole('region',{name:'Assigned practice block',exact:true})).toBeVisible()
  await d.getByRole('button',{name:'Done',exact:true}).click();await expect(d).toHaveCount(0)
  const assessments=page.getByRole('dialog',{name:'Coach assessments',exact:true});await expect(assessments.getByRole('button',{name:'Player & coach view',exact:true})).toBeFocused();await assessments.getByRole('button',{name:'Close',exact:true}).click()
  const w=page.getByRole('dialog',{name:'Coach workspace',exact:true});await w.getByRole('button',{name:/^Serve practice block/}).click();await expect(w).toContainText('Make 8 of 10 second serves.')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(1)
})

test('coach practice receipt waits for confirmation and keeps the same assignment on retry',async({page,server})=>{
  const d=await reviewCoachBlock(page),original=server.request,writes:unknown[]=[];let hideReply=true
  server.request=async request=>{const response=await original(request);if(new URL(request.url).pathname==='/api/mobile/coach'){if(request.method==='POST')writes.push(request.write);if(hideReply)return {...response,status:503,body:{ok:false}}}return response}
  await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d.getByRole('button',{name:'Retry same practice block',exact:true})).toBeEnabled();await expect(d.getByRole('region',{name:'Assigned practice block',exact:true})).toHaveCount(0)
  hideReply=false;await d.getByRole('button',{name:'Retry same practice block',exact:true}).click();await expect(d.getByRole('region',{name:'Assigned practice block',exact:true})).toBeVisible()
  expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(1)
})

test('coach practice receipt ignores a held save result after account change',async({page,server})=>{
  const d=await reviewCoachBlock(page,'Private confirmed coach target'),original=server.request;let held=false,release:()=>void=()=>{};const receipt=new Promise<void>(resolve=>{release=resolve})
  server.request=async request=>{const response=await original(request);if(new URL(request.url).pathname==='/api/mobile/coach'&&request.method==='POST'){held=true;await receipt}return response}
  await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect.poll(()=>held).toBe(true);await expect(d.getByRole('button',{name:'Close',exact:true})).toBeDisabled()
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());release();await expect(d).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Private confirmed coach target');await expect(page.getByRole('region',{name:'Assigned practice block',exact:true})).toHaveCount(0)
  const rows=(await server.db.query<{coach_user_id:string}>('select coach_user_id from coach_assignments')).rows;expect(rows).toHaveLength(1);expect(rows[0].coach_user_id).toBe(growthPlayer)
})

test('coach practice receipt clears its saved details and old actions on account change',async({page,server})=>{
  const d=await reviewCoachBlock(page,'Private confirmed coach target');await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d.getByRole('region',{name:'Assigned practice block',exact:true})).toBeVisible()
  await d.evaluate(el=>{(window as unknown as {oldCoachReceiptActions:HTMLElement[]}).oldCoachReceiptActions=[...el.querySelectorAll<HTMLElement>('[data-done],[data-back]')]})
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());await expect(d).toHaveCount(0)
  await page.evaluate(()=>{for(const action of (window as unknown as {oldCoachReceiptActions:HTMLElement[]}).oldCoachReceiptActions)action.click()})
  await expect(d).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Private confirmed coach target');await expect(page.locator('body')).toHaveAttribute('data-screen','lab')
  expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(1)
})

for(const action of ['Close','Escape'])test('coach practice receipt closes with '+action+' without assigning again',async({page,server})=>{
  const d=await reviewCoachBlock(page);await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d.getByRole('region',{name:'Assigned practice block',exact:true})).toBeVisible()
  if(action==='Close')await d.getByRole('button',{name:'Close',exact:true}).click();else await d.press('Escape')
  await expect(d).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Coach assessments',exact:true}).getByRole('button',{name:'Player & coach view',exact:true})).toBeFocused();expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(1)
})

test('keeps practice private and recovers a lost log reply after relaunch without duplicates',async({page,server},info)=>{
  await open(page);let d=await create(page)
  await d.getByLabel('What happened on court?').fill('7/10 second serves in');await d.getByRole('button',{name:'Review practice log',exact:true}).click();server.loseReply=true
  await d.getByRole('button',{name:'Confirm practice',exact:true}).click();await expect(d).toContainText('Retry the same update')
  await d.getByRole('button',{name:'Close',exact:true}).click();await d.getByRole('button',{name:'Leave plan',exact:true}).click();await expect(page.getByRole('region',{name:'Your practice focus',exact:true})).toContainText('Last confirmed');await expect(page.getByRole('button',{name:'Confirm plan update',exact:true})).toBeVisible()
  await page.reload();await page.getByRole('region',{name:'Your practice focus',exact:true}).getByRole('button',{name:'Confirm plan update'}).click();d=page.getByRole('dialog',{name:'My improvement plan',exact:true});await expect(d).toContainText('An update needs confirmation');await expect(d.getByLabel('What happened on court?')).toBeDisabled();await d.getByRole('button',{name:'Retry pending update'}).click();await expect(d).toContainText('1 / 3')
  const plans=(await server.db.query<{payload:{logs:unknown[]}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows
  expect(plans[0].payload.logs).toHaveLength(1);expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
  await d.screenshot({path:info.outputPath('private-improvement-plan.png')})
})
for(const width of [320,390])test('resumes the saved practice focus from My Lab and updates its count without another home read at '+width+'px',async({page,server},info)=>{
  await page.setViewportSize({width,height:844});let p=await coachedPlan(page,server,undefined,width===320)
  await p.getByRole('button',{name:'Close',exact:true}).click();const home=page.getByRole('region',{name:'Your practice focus',exact:true})
  await expect(home).toContainText('8 of 10 second serves in');await expect(home).toContainText('2 / 3 practices');await expect(home.locator('time')).toHaveCount(1);await expect(home).not.toContainText('Private practice note');await expect(home).not.toContainText(growthId(2))
  await home.evaluate(el=>el.scrollIntoView({block:'center'}));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await home.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await expect.poll(async()=>{const button=await home.getByRole('button',{name:'Resume practice plan'}).boundingBox(),nav=await page.locator('.app-navigation').boundingBox();return Boolean(button&&nav&&button.y+button.height<=nav.y)}).toBe(true)
  await home.screenshot({path:info.outputPath('practice-focus-'+width+'.png')})
  await home.getByRole('button',{name:'Resume practice plan'}).click();p=page.getByRole('dialog',{name:'My improvement plan',exact:true});await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled()
  const before=server.planReads
  await p.getByRole('button',{name:'Log next practice',exact:true}).click();await p.getByLabel('What happened on court?').fill('9 of 10 serves in with a smooth finish');await p.getByRole('button',{name:'Review practice log'}).click();await p.getByRole('button',{name:'Confirm practice',exact:true}).click();await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled()
  expect(server.planReads).toBe(before+1)
  await p.getByRole('button',{name:'Close',exact:true}).click();await expect(home).toContainText('3 / 3 practices');await expect(home).toContainText('Review ready');await expect(home.getByRole('button',{name:'Review practice plan'})).toBeFocused();await home.getByRole('button',{name:'Review practice plan'}).click();await expect(p).toContainText('Your planned practices are logged')
  const rows=(await server.db.query<{payload:{logs:unknown[]}}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows;expect(rows).toHaveLength(1);expect(rows[0].payload.logs).toHaveLength(3)
})

for(const width of [320,390])test('restores practice actions when a note and date are reverted at '+width+'px',async({page,server})=>{
  await page.setViewportSize({width,height:844})
  const p=await coachedPlan(page,server,undefined,width===320)
  const notes=p.getByLabel('What happened on court?'),date=p.getByLabel('Practice date')
  const next=p.getByRole('button',{name:'Log next practice',exact:true})
  const coach=p.getByRole('button',{name:'Prepare coach check-in',exact:true})
  const refresh=p.getByRole('button',{name:'Refresh plan',exact:true})
  const review=p.getByRole('button',{name:'Review completed plan',exact:true})
  const initial=(await server.db.query('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows
  const originalDate=await date.inputValue(),reads=server.planReads
  await expect(next).toBeEnabled();await expect(coach).toBeEnabled();await expect(review).toBeDisabled()
  await notes.fill('An unsaved court result')
  await expect(next).toBeDisabled();await expect(coach).toBeDisabled();await expect(refresh).toBeDisabled()
  await notes.fill('')
  await expect(notes).toBeFocused()
  await expect(next).toBeEnabled();await expect(coach).toBeEnabled();await expect(refresh).toBeEnabled()
  await expect(review).toBeDisabled()
  const changedDate=new Date(originalDate+'T12:00:00Z');changedDate.setUTCDate(changedDate.getUTCDate()+1)
  await date.fill(changedDate.toISOString().slice(0,10))
  await expect(next).toBeDisabled()
  await date.fill(originalDate)
  await expect(next).toBeEnabled()
  await notes.fill('Keep this until I change my mind')
  await p.getByRole('button',{name:'Close',exact:true}).click()
  await p.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(notes).toHaveValue('Keep this until I change my mind')
  await expect(coach).toBeDisabled()
  await notes.fill('')
  await expect(coach).toBeEnabled();await expect(review).toBeDisabled()
  await notes.fill('A practice I decided not to record')
  await p.getByRole('button',{name:'Review practice log',exact:true}).click()
  await p.getByRole('button',{name:'Back to plan',exact:true}).click()
  await expect(notes).toHaveValue('A practice I decided not to record')
  await notes.fill('')
  await expect(next).toBeEnabled();await expect(coach).toBeEnabled();await expect(review).toBeDisabled()
  expect(server.planReads).toBe(reads)
  expect((await server.db.query('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows).toEqual(initial)
  await next.click();await expect(notes).toBeFocused()
  await coach.click()
  await expect(p.getByRole('heading',{name:'Prepare check-in',exact:true})).toBeVisible()
  await expect(p.getByRole('checkbox')).toHaveCount(2)
  expect((await server.db.query('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows).toEqual(initial)
})

test('restores the saved practice focus after relaunch and opens the same active plan',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await expect(page.locator('.lab-starter-tiq')).toBeVisible();await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner())
  const home=page.getByRole('region',{name:'Your practice focus',exact:true});await expect(home).toContainText('2 / 3 practices');await home.getByRole('button',{name:'Resume practice plan'}).click();await expect(p).toContainText('8 of 10 second serves in');await expect(p).toContainText('2 / 3 practices')
  await p.getByRole('button',{name:'Archive plan',exact:true}).click();await p.getByRole('button',{name:'Confirm archive',exact:true}).click();await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Close',exact:true}).click();await expect(home).toHaveCount(0)
  await expect(page.getByRole('button',{name:'My improvement plan',exact:true})).toBeFocused()
})

test('keeps a failed My Lab plan read separate from an empty plan and retries without writing',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Close',exact:true}).click();const home=page.getByRole('region',{name:'Your practice focus',exact:true})
  server.failRead=true;await home.getByRole('button',{name:'Refresh plan focus'}).click();await expect(home).toContainText('couldn’t load');await expect(home).not.toContainText('8 of 10 second serves in');await expect(home.getByRole('button',{name:'Resume practice plan'})).toHaveCount(0)
  await home.getByRole('button',{name:'Open plans',exact:true}).click();await expect(p).toContainText('couldn’t be confirmed');await expect(p.getByRole('button',{name:'Create improvement plan'})).toHaveCount(0);await p.getByRole('button',{name:'Close',exact:true}).click()
  server.failRead=false;await home.getByRole('button',{name:'Retry plan',exact:true}).click();await expect(home).toContainText('2 / 3 practices');expect((await server.db.query('select * from my_lab_goals where user_id=$1',[growthPeer])).rows).toHaveLength(1)
})

test('offers unreadable device-update recovery from My Lab before resuming practice',async({page,server})=>{
  await page.addInitScript(owner=>localStorage.setItem('tiq-growth-pending:v1:'+owner,'corrupted'),growthPeer)
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Close',exact:true}).click();const home=page.getByRole('region',{name:'Your practice focus',exact:true})
  await expect(home).toContainText('Device retry details couldn’t load');await home.getByRole('button',{name:'Confirm plan update'}).click();await expect(p).toContainText('Device retry details couldn’t load');await expect(p.getByRole('button',{name:'Review practice log'})).toBeDisabled()
  await p.getByRole('button',{name:'Discard retry and refresh'}).click();await expect(p.getByRole('button',{name:'Review practice log'})).toBeEnabled();await p.getByRole('button',{name:'Close',exact:true}).click();await expect(home.getByRole('button',{name:'Resume practice plan'})).toBeEnabled();await expect(home).not.toContainText('Device retry details couldn’t load')
})

test('clears My Lab practice focus on account change and ignores its held response',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Close',exact:true}).click();server.holdPlanReply=true
  await page.getByRole('region',{name:'Your practice focus',exact:true}).getByRole('button',{name:'Refresh plan focus'}).click();await expect.poll(()=>server.planReplyHeld).toBe(true)
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:(restore:boolean)=>void}).switchNavigationOwner(true));server.release();await expect.poll(()=>server.planReplyHeld).toBe(false)
  await expect(page.locator('body')).not.toContainText('8 of 10 second serves in');await expect(page.getByRole('region',{name:'Your practice focus',exact:true})).toHaveCount(0)
})

test('does not let an older My Lab response replace progress confirmed in the plan editor',async({page,server})=>{
  let p=await coachedPlan(page,server);await p.getByRole('button',{name:'Close',exact:true}).click();const home=page.getByRole('region',{name:'Your practice focus',exact:true});server.holdPlanReply=true
  await home.getByRole('button',{name:'Refresh plan focus'}).click();await expect.poll(()=>server.planReplyHeld).toBe(true)
  p=await plan(page);await p.getByLabel('What happened on court?').fill('Confirmed third practice');await p.getByRole('button',{name:'Review practice log'}).click();await p.getByRole('button',{name:'Confirm practice',exact:true}).click();await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Close',exact:true}).click()
  await expect(home).toContainText('3 / 3 practices');server.release();await expect.poll(()=>server.planReplyHeld).toBe(false);await expect(home).toContainText('3 / 3 practices');await expect(home).not.toContainText('2 / 3 practices')
})

test('keeps an assessment answer and keyboard focus when the My Lab plan reply arrives',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Close',exact:true}).click();server.holdPlanReply=true
  await page.getByRole('region',{name:'Your practice focus',exact:true}).getByRole('button',{name:'Refresh plan focus'}).click();await expect.poll(()=>server.planReplyHeld).toBe(true)
  const card=page.locator('.lab-starter-tiq');await card.getByRole('button',{name:'Retake',exact:true}).click();const answer=card.getByRole('combobox').first();await answer.selectOption('3');await answer.focus()
  server.release();await expect.poll(()=>server.planReplyHeld).toBe(false);await expect(page.getByRole('region',{name:'Your practice focus',exact:true})).toContainText('2 / 3 practices');await expect(answer).toHaveValue('3');await expect(answer).toBeFocused()
})

test('shows dated coach and shared player sources, then clears them when access is revoked',async({page,server},info)=>{
  await open(page);const d=await alignment(page);await expect(d.getByRole('table')).toBeVisible();await expect(d).toContainText('3 not observed');await expect(d).toContainText('On-court drill')
  await d.screenshot({path:info.outputPath('player-coach-alignment.png')})
  server.revoked=true;await d.getByRole('button',{name:'Refresh shared assessments'}).click();await expect(d.getByRole('table')).toHaveCount(0);await expect(d).toContainText('current coach connection')
})
test('launch usability: coach invitation through assigned practice, player check-in and reviewed feedback',async({page,server},info)=>{
  await open(page)
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner())
  await page.evaluate(()=>(window as unknown as {openSyntheticLink:(url:string)=>void}).openSyntheticLink('https://www.tenaceiq.com/coach/invite/growth-invite'))
  const invite=page.getByRole('dialog',{name:'Accept coach invitation',exact:true}),handoff=page.getByRole('button',{name:'Open link',exact:true});await expect(invite.or(handoff).first()).toBeVisible();if(!await invite.isVisible())await handoff.click();await expect(invite.getByRole('button',{name:'Connect my account'})).toBeEnabled();await invite.screenshot({path:info.outputPath('audit-coach-01-invitation.png')});await invite.getByRole('button',{name:'Connect my account'}).click();await expect(invite).toContainText('You’re connected');await invite.getByRole('button',{name:'Close',exact:true}).click()
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:(restore:boolean)=>void}).switchNavigationOwner(true))
  const d=await alignment(page);await d.getByRole('button',{name:'Plan practice block'}).click();await d.getByLabel('Measurable target').fill('8 of 10 second serves in');await d.getByRole('button',{name:'Review practice block',exact:true}).click();await d.screenshot({path:info.outputPath('audit-coach-02-assignment.png')});await d.getByRole('button',{name:'Assign practice block',exact:true}).click();await expect(d).toContainText('Practice block assigned.')
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner())
  await page.getByRole('button',{name:'My Lab',exact:true}).click();const p=await plan(page)
  await p.getByText('Coach practice blocks',{exact:true}).click();await p.getByRole('button',{name:'Use Serve practice block',exact:true}).click();await p.getByRole('button',{name:'Review plan',exact:true}).click();await p.getByRole('button',{name:'Edit plan',exact:true}).click();await expect(p.getByLabel('Measurable target')).toBeDisabled();await expect(p.getByRole('combobox',{name:'Skill',exact:true})).toBeDisabled();await expect(p.getByLabel('Starting assessment')).toBeEnabled();await p.getByRole('button',{name:'Review plan',exact:true}).click();await p.getByRole('button',{name:'Save improvement plan',exact:true}).click();await expect(p).toContainText('8 of 10 second serves in')
  await p.getByLabel('What happened on court?').fill('8/10 in');await p.getByRole('button',{name:'Review practice log'}).click();await p.getByRole('button',{name:'Confirm practice'}).click();await expect(p).toContainText('1 / 3')
  await p.getByRole('button',{name:'Prepare coach check-in'}).click();await p.getByRole('checkbox',{name:/8\/10 in/}).check();await p.getByRole('button',{name:'Continue to check-in'}).click();const check=page.getByRole('dialog',{name:'Coach assignment check-in',exact:true});await expect(check.getByLabel('Your recap')).toHaveValue(/1 of 3 planned practices/);await check.getByRole('button',{name:'Review check-in'}).click();await check.screenshot({path:info.outputPath('audit-coach-03-check-in.png')});await check.getByRole('button',{name:'Send check-in',exact:true}).click();await expect(check).toHaveCount(0)
  const overview=(await server.db.query<{v:{counts:{feedback:number}}}>('select native_coach_growth_overview($1,$2) v',[growthPlayer,server.day])).rows[0].v;expect(overview.counts.feedback).toBe(1)
  expect((await server.db.query('select * from my_lab_goals where user_id=$1',[growthPeer])).rows).toHaveLength(1)
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:(restore:boolean)=>void}).switchNavigationOwner(true))
  const w=await workspace(page)
  await expect(w.locator('.tiq-growth-attention')).toContainText('1 awaiting feedback');await w.locator('[data-growth-attention]').first().click();await w.getByRole('button',{name:'Review player check-in',exact:true}).click();await w.getByLabel('Your feedback',{exact:true}).fill('Good target control. Keep the second serve smooth.');await w.getByLabel('Next tennis focus',{exact:true}).fill('Aim for eight serves in during pressure points.');await w.getByRole('button',{name:'Review feedback',exact:true}).click();await w.getByRole('button',{name:'Save feedback',exact:true}).click();await expect(w).toContainText('Saved to your Coach workspace.');await w.getByRole('button',{name:/^Serve practice block/}).click();await expect(w).toContainText('Good target control.');await w.screenshot({path:info.outputPath('audit-coach-04-reviewed-feedback.png')})
})
for(const width of [320,390])test('chooses private plan notes for check-in and shows the coach response at '+width+'px',async({page,server},info)=>{
  await page.setViewportSize({width,height:844});const p=await coachedPlan(page,server,undefined,width===320)
  await p.getByRole('button',{name:'Prepare coach check-in'}).click()
  await expect(p.getByRole('heading',{name:'Prepare check-in',exact:true})).toBeVisible()
  for(const box of await p.getByRole('checkbox').all())await expect(box).not.toBeChecked()
  await expect(p.locator('[data-share-proof]')).toHaveText('Only your practice count and target are included.')
  if(width===390){
    await p.getByRole('button',{name:'Continue to check-in'}).click();const blank=page.getByRole('dialog',{name:'Coach assignment check-in'})
    await expect(blank.getByLabel('Proof or next-match cue')).toHaveValue('');await blank.getByRole('button',{name:'Close check-in'}).click();await blank.getByRole('button',{name:'Discard recap',exact:true}).click()
  }
  const selected=p.getByRole('checkbox',{name:/8\/10 second serves in/});await selected.focus();await selected.press('Space');await expect(selected).toBeChecked();await expect(selected).toBeFocused()
  await expect(p.locator('[data-share-proof]')).not.toContainText('Private practice note')
  expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await p.screenshot({path:info.outputPath('choose-coach-notes-'+width+'.png')})
  await p.getByRole('button',{name:'Continue to check-in'}).click();const check=page.getByRole('dialog',{name:'Coach assignment check-in',exact:true})
  await expect(check.getByLabel('Proof or next-match cue')).toHaveValue(server.day+': 8/10 second serves in')
  if(width===320){
    await check.getByRole('button',{name:'Close check-in'}).click();await check.getByRole('button',{name:'Discard recap',exact:true}).click()
    await expect(p.getByRole('checkbox',{name:/8\/10 second serves in/})).toBeChecked();await p.getByRole('button',{name:'Continue to check-in'}).click()
  }
  await check.getByRole('button',{name:'Review check-in'}).click()
  const before=(await server.db.query<{assignment_json:{playerCheckIn?:unknown}}>('select assignment_json from coach_assignments')).rows[0].assignment_json;expect(before.playerCheckIn).toBeUndefined()
  await expect(check).not.toContainText('Private practice note');await expect(check).toContainText('marks the assignment complete')
  if(width===390)server.loseCheckInReply=true
  await check.getByRole('button',{name:'Send check-in',exact:true}).click()
  if(width===390){await expect(check.getByRole('button',{name:'Check saved check-in'})).toBeVisible();await check.getByRole('button',{name:'Check saved check-in'}).click()}
  await expect(check).toHaveCount(0);await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled()
  const coaching=p.getByRole('region',{name:'Plan coaching'});await expect(coaching).toContainText('Awaiting coach feedback');await expect(p.getByRole('button',{name:'Prepare coach check-in'})).toHaveCount(0)
  const sent=(await server.db.query<{assignment_json:{playerCheckIn:{recap:string;evidence:string}}}>('select assignment_json from coach_assignments')).rows[0].assignment_json.playerCheckIn
  expect(sent.evidence).toBe(server.day+': 8/10 second serves in');expect(sent.recap).toContain('2 of 3 planned practices');expect(JSON.stringify(sent)).not.toContain(growthId(2))
  await server.db.query('update coach_assignments set assignment_json=assignment_json||$1::jsonb',[JSON.stringify({coachReview:{note:'Keep the finish smooth.',nextFocus:'Aim deep under pressure.',reviewedAt:new Date().toISOString()}})])
  await p.getByRole('button',{name:'Refresh plan',exact:true}).click();await expect(coaching).toContainText('Keep the finish smooth.');await expect(coaching).toContainText('Aim deep under pressure.');await expect(coaching.locator('time')).toHaveCount(1)
  expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await coaching.scrollIntoViewIfNeeded();await expect(coaching).toBeInViewport();await p.screenshot({path:info.outputPath('coach-feedback-'+width+'.png')})
  await server.db.query("update coach_player_links set status='paused'");await p.getByRole('button',{name:'Refresh plan',exact:true}).click();await expect(coaching).toContainText('Coach check-in unavailable');await expect(p).not.toContainText('Keep the finish smooth.')
})

test('keeps full selected notes and asks for fewer rather than cutting off court evidence',async({page,server})=>{
  const first='First practice '+ 'a'.repeat(145),second='Second practice '+ 'b'.repeat(144),p=await coachedPlan(page,server,[first,second])
  await p.getByRole('button',{name:'Prepare coach check-in'}).click();await expect(p.getByRole('checkbox')).toHaveCount(2);for(const box of await p.getByRole('checkbox').all())await box.check()
  await expect(p.locator('[data-share-count]')).toContainText('Choose fewer notes');await expect(p.getByRole('button',{name:'Continue to check-in'})).toBeDisabled();await expect(p.locator('[data-share-proof]')).toContainText(second)
  await p.getByRole('checkbox',{name:new RegExp(first)}).uncheck();await expect(p.getByRole('button',{name:'Continue to check-in'})).toBeEnabled();await p.getByRole('button',{name:'Continue to check-in'}).click()
  await expect(page.getByRole('dialog',{name:'Coach assignment check-in'}).getByLabel('Proof or next-match cue')).toHaveValue(server.day+': '+second)
})

test('rechecks a changed plan before copying chosen notes into a coach draft',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Prepare coach check-in'}).click();await p.getByRole('checkbox',{name:/8\/10 second serves in/}).check()
  const row=(await server.db.query<{payload:{id:string;revision:string}}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows[0].payload
  expect((await server.db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[growthPeer,JSON.stringify({kind:'log',id:row.id,expected:row.revision,operation:growthId(150),session:{id:growthId(151),date:server.day,note:'Practice on another device'}})])).rows[0].s).toBe(200)
  await p.getByRole('button',{name:'Continue to check-in'}).click();await expect(p).toContainText('Your plan or coach assignment changed');await expect(page.getByRole('dialog',{name:'Coach assignment check-in'})).toHaveCount(0);await expect(p).toContainText('3 / 3')
  await p.getByRole('button',{name:'Prepare coach check-in'}).click();for(const box of await p.getByRole('checkbox').all())await expect(box).not.toBeChecked()
})

test('stops the plan handoff when the coach changes its assignment target',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Prepare coach check-in'}).click();await p.getByRole('checkbox',{name:/8\/10 second serves in/}).check()
  await server.db.query("update coach_assignments set assignment_json=jsonb_set(assignment_json,'{tiqGrowth,target}','\"New coach target\"'),updated_at=now()")
  await p.getByRole('button',{name:'Continue to check-in'}).click();await expect(p.getByRole('region',{name:'Plan coaching'})).toContainText('Coach assignment updated');await expect(p.getByRole('button',{name:'Prepare coach check-in'})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Coach assignment check-in'})).toHaveCount(0)
  expect((await server.db.query<{assignment_json:{playerCheckIn?:unknown}}>('select assignment_json from coach_assignments')).rows[0].assignment_json.playerCheckIn).toBeUndefined()
})

test('keeps note choices when a check-in preflight read fails and retries without sending',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Prepare coach check-in'}).click();await p.getByRole('checkbox',{name:/8\/10 second serves in/}).check();server.failRead=true
  await p.getByRole('button',{name:'Continue to check-in'}).click();await expect(p).toContainText('couldn’t be confirmed');await expect(p.getByRole('checkbox',{name:/8\/10 second serves in/})).toBeChecked();await expect(page.getByRole('dialog',{name:'Coach assignment check-in'})).toHaveCount(0)
  server.failRead=false;await p.getByRole('button',{name:'Continue to check-in'}).click();await expect(page.getByRole('dialog',{name:'Coach assignment check-in'}).getByLabel('Proof or next-match cue')).toHaveValue(server.day+': 8/10 second serves in')
  expect((await server.db.query<{assignment_json:{playerCheckIn?:unknown}}>('select assignment_json from coach_assignments')).rows[0].assignment_json.playerCheckIn).toBeUndefined()
})

test('clears chosen private practice notes on account change and ignores a late preflight',async({page,server})=>{
  const p=await coachedPlan(page,server);await p.getByRole('button',{name:'Prepare coach check-in'}).click();await p.getByRole('checkbox',{name:/Private practice note/}).check();server.hold=true
  await p.getByRole('button',{name:'Continue to check-in'}).click();await page.evaluate(()=>(window as unknown as {switchNavigationOwner:(restore:boolean)=>void}).switchNavigationOwner(true));server.release()
  await expect(p).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Coach assignment check-in'})).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Private practice note')
})

for(const width of [320,390])test('turns current coach feedback into a reviewed private follow-up without changing the completed plan at '+width+'px',async({page,server},info)=>{
  await page.setViewportSize({width,height:844});const prepared=await reviewedCoachPlan(page,server,undefined,width===320);let p=prepared.p
  await p.getByRole('button',{name:'Plan next practice',exact:true}).click();await expect(p.getByRole('heading',{name:'Next practice plan',exact:true})).toBeVisible()
  await expect(p.getByLabel('Starting assessment')).toHaveValue(growthId(240));await expect(p.getByLabel('Measurable target')).toHaveValue(prepared.cue);await expect(p.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('serve')
  const source=p.getByRole('region',{name:'Coach feedback for next plan'});await expect(source).toContainText('Serve practice block');await expect(source).toContainText(prepared.cue);await expect(source.locator('time')).toHaveCount(1)
  await p.getByLabel('Measurable target').fill('8 of 10 second serves in during a pressure game');await p.getByLabel('Practices',{exact:true}).fill('4')
  expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await p.screenshot({path:info.outputPath('coach-followup-'+width+'.png')})
  await p.getByRole('button',{name:'Review plan',exact:true}).click();await p.getByRole('button',{name:'Edit plan',exact:true}).click()
  await expect(p.getByLabel('Measurable target')).toHaveValue('8 of 10 second serves in during a pressure game');await expect(p.getByLabel('Measurable target')).toBeEditable();await expect(p.getByLabel('Practices',{exact:true})).toHaveValue('4');await expect(source).toContainText(prepared.cue)
  await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('button',{name:'Keep editing'}).click();await expect(p.getByLabel('Measurable target')).toHaveValue('8 of 10 second serves in during a pressure game')
  expect((await server.db.query('select goal_id from my_lab_goals where user_id=$1',[growthPeer])).rows).toHaveLength(1)
  await p.getByRole('button',{name:'Review plan',exact:true}).click();if(width===390)server.loseReply=true
  await p.getByRole('button',{name:'Save improvement plan',exact:true}).click()
  if(width===390){
    await expect(p).toContainText('Retry the same update');await expect(p.getByRole('button',{name:'Edit plan',exact:true})).toBeDisabled()
    await page.reload();await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());p=await plan(page);await p.getByRole('button',{name:'Retry pending update'}).click()
  }
  await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled();await expect(p).toContainText('0 / 4')
  const goals=(await server.db.query<{payload:Record<string,unknown>}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows.map(row=>row.payload)
  expect(goals).toHaveLength(2);expect(goals.find(row=>row.id===prepared.original.id)).toEqual(prepared.original)
  expect(goals.find(row=>row.id!==prepared.original.id)).toMatchObject({baseline:growthId(240),sourceAssignment:null,state:'active',logs:[],block:{skill:'serve',sessions:4,target:'8 of 10 second serves in during a pressure game'}})
  const assignments=(await server.db.query<{status:string}>('select status from coach_assignments')).rows;expect(assignments).toEqual([{status:'completed'}])
  expect((await server.db.query('select id from private.tiq_self_assessments where owner_id=$1',[growthPeer])).rows).toHaveLength(2)
})

test('keeps a long coach cue whole and cancels the follow-up without saving or changing its source',async({page,server})=>{
  const cue='Serve cue '.repeat(27).trim(),{p,original}=await reviewedCoachPlan(page,server,cue)
  await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p.getByLabel('Measurable target')).toHaveValue('');await expect(p.getByRole('region',{name:'Coach feedback for next plan'})).toContainText(cue);await expect(p).toContainText('Write a shorter, measurable target')
  await p.getByLabel('Measurable target').fill('8 of 10 serves to a deep target');await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await expect(p.getByRole('heading',{name:'Discard new plan?',exact:true})).toBeVisible();await p.getByRole('button',{name:'Discard new plan',exact:true}).click()
  await expect(p.getByRole('button',{name:'Plan next practice',exact:true})).toBeFocused()
  await expect(p.getByRole('button',{name:'Plan next practice'})).toBeEnabled();expect((await server.db.query<{payload:unknown}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows.map(row=>row.payload)).toEqual([original])
})

test('shows updated coach feedback before allowing a new follow-up draft',async({page,server})=>{
  const {p}=await reviewedCoachPlan(page,server)
  await server.db.query("update coach_assignments set assignment_json=jsonb_set(assignment_json,'{coachReview,nextFocus}','\"9 of 10 second serves in\"')")
  await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p).toContainText('Your plan or coach feedback changed');await expect(p.getByRole('region',{name:'Plan coaching'})).toContainText('9 of 10 second serves in');await expect(p.getByLabel('Measurable target')).toHaveCount(0)
  await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p.getByLabel('Measurable target')).toHaveValue('9 of 10 second serves in')
})

test('clears paused coach feedback before a follow-up draft can be prepared',async({page,server})=>{
  const {p,cue}=await reviewedCoachPlan(page,server);await server.db.query("update coach_player_links set status='paused'")
  await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p).toContainText('This coach feedback is no longer available');await expect(p.getByLabel('Measurable target')).toHaveCount(0);await expect(p.getByRole('button',{name:'Plan next practice'})).toHaveCount(0);await expect(p).not.toContainText(cue)
})

test('opens another device active plan rather than creating a competing follow-up',async({page,server})=>{
  const {p,original}=await reviewedCoachPlan(page,server)
  expect((await server.db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[growthPeer,JSON.stringify({kind:'new',id:growthId(260),operation:growthId(261),expected:null,baseline:growthId(240),sourceAssignment:null,block:{...(original.block as Record<string,unknown>),target:'Other device court target'}})])).rows[0].s).toBe(200)
  await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p).toContainText('You already have an active plan');await expect(p.getByLabel('Measurable target')).toHaveCount(0);await p.getByRole('button',{name:'Open active plan'}).click();await expect(p).toContainText('Other device court target')
  expect((await server.db.query('select goal_id from my_lab_goals where user_id=$1',[growthPeer])).rows).toHaveLength(2)
})

test('recovers a failed follow-up read by refreshing without inventing an empty plan',async({page,server})=>{
  const {p}=await reviewedCoachPlan(page,server);server.failRead=true
  await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p).toContainText('couldn’t be confirmed');await expect(p.getByLabel('Measurable target')).toHaveCount(0);await expect(p.getByRole('button',{name:'Plan next practice'})).toHaveCount(0)
  server.failRead=false;await p.getByRole('button',{name:'Refresh plan',exact:true}).click();await p.getByRole('button',{name:'Plan next practice'}).click();await expect(p.getByRole('heading',{name:'Next practice plan',exact:true})).toBeVisible()
  expect((await server.db.query('select goal_id from my_lab_goals where user_id=$1',[growthPeer])).rows).toHaveLength(1)
})

test('ignores a late follow-up read after the player account changes',async({page,server})=>{
  const {p,cue}=await reviewedCoachPlan(page,server);server.hold=true;await p.getByRole('button',{name:'Plan next practice'}).click()
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:(restore:boolean)=>void}).switchNavigationOwner(true));server.release()
  await expect(p).toHaveCount(0);await expect(page.locator('body')).not.toContainText(cue);await expect(page.getByRole('heading',{name:'Next practice plan',exact:true})).toHaveCount(0)
})

for(const width of [320,390])test('keeps plan and alignment controls within the phone at '+width+'px',async({page},info)=>{
  await page.setViewportSize({width,height:844});await open(page,width===320);const p=await create(page)
  expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await p.screenshot({path:info.outputPath('plan-'+width+'.png')});await p.getByRole('button',{name:'Close',exact:true}).click()
  const d=await alignment(page);expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await d.screenshot({path:info.outputPath('alignment-'+width+'.png')})
})
test('plan cancellation reviews a changed target before discarding the new plan',async({page,server})=>{
  await open(page);const p=await plan(page)
  await p.getByRole('button',{name:'Create improvement plan',exact:true}).click()
  await p.getByRole('textbox',{name:'Measurable target',exact:true}).fill('8 of 10 second serves under pressure')
  await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await expect(p.getByRole('heading',{name:'Discard new plan?',exact:true})).toBeVisible()
  await p.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(p.getByRole('textbox',{name:'Measurable target',exact:true})).toHaveValue('8 of 10 second serves under pressure')
  await expect(p.getByRole('textbox',{name:'Measurable target',exact:true})).toBeFocused()
  expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
})

for(const width of [320,390])test('plan cancellation keeps incomplete fields and the chosen baseline at '+width+'px',async({page,server},info)=>{
  await server.assess(growthPlayer,30,{serve:3})
  await page.setViewportSize({width,height:844});await open(page,width===320);const p=await plan(page)
  await p.getByRole('button',{name:'Create improvement plan',exact:true}).click()
  const baseline=p.getByLabel('Starting assessment'),target=p.getByRole('textbox',{name:'Measurable target',exact:true}),sessions=p.getByLabel('Practices',{exact:true}),date=p.getByLabel('Review date',{exact:true})
  const reviewDate=await date.inputValue()
  await baseline.selectOption(growthId(1));await target.fill('  8 of 10 deep rallies under pressure  ')
  await p.getByRole('combobox',{name:'Skill',exact:true}).selectOption('rally');await date.fill('');await sessions.fill('')
  await p.getByRole('button',{name:width===320?'Cancel new plan':'Close',exact:true}).click()
  await expect(p.getByRole('heading',{name:width===320?'Discard new plan?':'Leave plan?',exact:true})).toBeVisible()
  expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  if(width===320&&info.project.name==='mobile-webkit')await p.screenshot({path:info.outputPath('plan-cancel-review-320.png')})
  await p.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(target).toHaveValue('  8 of 10 deep rallies under pressure  ');await expect(baseline).toHaveValue(growthId(1))
  await expect(p.getByRole('combobox',{name:'Skill',exact:true})).toHaveValue('rally');await expect(sessions).toHaveValue('');await expect(date).toHaveValue('');await expect(sessions).toBeFocused()
  await expect.poll(()=>sessions.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest('dialog')!.getBoundingClientRect();return r.top>=d.top&&r.bottom<=Math.min(d.bottom,innerHeight)+1})).toBe(true)
  expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
  await sessions.fill('4');await date.fill(reviewDate);await p.getByRole('button',{name:'Review plan',exact:true}).click()
  await p.getByRole('button',{name:'Edit plan',exact:true}).click();await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await p.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(date).toBeFocused();await expect(baseline).toHaveValue(growthId(1));await expect(sessions).toHaveValue('4')
  await p.getByRole('button',{name:'Review plan',exact:true}).click();await p.getByRole('button',{name:'Save improvement plan',exact:true}).click()
  await expect(p.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled()
  const rows=(await server.db.query<{payload:{baseline:string;block:{skill:string;target:string;sessions:number;reviewDate:string}}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows
  expect(rows).toHaveLength(1);expect(rows[0].payload.baseline).toBe(growthId(1));expect(rows[0].payload.block).toMatchObject({skill:'rally',target:'8 of 10 deep rallies under pressure',sessions:4,reviewDate})
})

test('plan cancellation returns an untouched new plan immediately to its entry',async({page,server})=>{
  await open(page);const p=await plan(page),reads=server.planReads
  await p.getByRole('button',{name:'Create improvement plan',exact:true}).click();await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await expect(p.getByRole('button',{name:'Create improvement plan',exact:true})).toBeFocused();await expect(p.getByRole('heading',{name:'Discard new plan?',exact:true})).toHaveCount(0)
  expect(server.planReads).toBe(reads);expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
})

test('plan cancellation returns an untouched coach follow-up to the same feedback',async({page,server})=>{
  const {p,original,cue}=await reviewedCoachPlan(page,server)
  await p.getByRole('button',{name:'Plan next practice',exact:true}).click();await expect(p.getByRole('heading',{name:'Next practice plan',exact:true})).toBeVisible()
  const reads=server.planReads
  await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await expect(p.getByRole('button',{name:'Plan next practice',exact:true})).toBeFocused();await expect(p.getByRole('region',{name:'Plan coaching',exact:true})).toContainText(cue)
  expect(server.planReads).toBe(reads);expect((await server.db.query<{payload:unknown}>('select payload from my_lab_goals where user_id=$1',[growthPeer])).rows.map(row=>row.payload)).toEqual([original])
})

for(const changed of [false,true])test('plan cancellation returns '+(changed?'a changed':'an untouched')+' coach block to its original invitation',async({page,server})=>{
  const day=new Date(server.day+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+7)
  const block={version:1,skill:'serve',target:'8 of 10 second serves in',sessions:3,reviewDate:day.toISOString().slice(0,10)}
  await server.db.query("insert into coach_assignments values('practice-block',$1,'student-one','Serve practice block','Second serve',$2,'assigned',$3,now())",[growthPlayer,block.reviewDate,JSON.stringify({tiqGrowth:block,cardId:'serve-target-call'})])
  await server.assess(growthPeer,30,{serve:3})
  const before=(await server.db.query('select * from coach_assignments')).rows
  await open(page);await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());const p=await plan(page)
  await p.getByText('Coach practice blocks',{exact:true}).click()
  await p.getByRole('button',{name:'Use Serve practice block',exact:true}).click()
  const baseline=p.getByLabel('Starting assessment')
  if(changed){
    await baseline.selectOption(growthId(2));await p.getByRole('button',{name:'Cancel new plan',exact:true}).click();await p.getByRole('button',{name:'Keep editing',exact:true}).click()
    await expect(baseline).toHaveValue(growthId(2));await expect(baseline).toBeFocused()
  }
  await expect(p.getByRole('textbox',{name:'Measurable target',exact:true})).toBeDisabled();await expect(p.getByLabel('Practices',{exact:true})).toBeDisabled();await expect(p.getByRole('combobox',{name:'Skill',exact:true})).toBeDisabled();await expect(p.getByLabel('Review date',{exact:true})).toBeDisabled()
  await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  if(changed)await p.getByRole('button',{name:'Discard new plan',exact:true}).click()
  const invitation=p.getByRole('button',{name:'Use Serve practice block',exact:true});await expect(invitation).toBeFocused();await expect(invitation).toBeVisible()
  expect((await server.db.query('select * from coach_assignments')).rows).toEqual(before);expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
  await invitation.click();await expect(baseline).toHaveValue(growthId(30));await expect(p.getByRole('textbox',{name:'Measurable target',exact:true})).toHaveValue(block.target)
})

test('plan cancellation clears a kept departure and follows only a later navigation choice',async({page,server})=>{
  await open(page);const p=await plan(page)
  await p.getByRole('button',{name:'Create improvement plan',exact:true}).click();const target=p.getByRole('textbox',{name:'Measurable target',exact:true})
  await target.fill('8 of 10 serves in');await p.getByRole('button',{name:'Cancel new plan',exact:true}).click();await page.keyboard.press('Escape');await expect(target).toBeFocused()
  await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tenaceiq:navigate',{detail:{href:'/coach'}})))
  await expect(p.getByRole('heading',{name:'Leave plan?',exact:true})).toBeVisible();await expect(p.getByRole('button',{name:'Discard new plan',exact:true})).toHaveCount(0)
  await p.getByRole('button',{name:'Keep editing',exact:true}).click();await p.getByRole('button',{name:'Cancel new plan',exact:true}).click();await p.getByRole('button',{name:'Discard new plan',exact:true}).click()
  await expect(page.locator('body')).toHaveAttribute('data-screen','lab');await expect(p.getByRole('button',{name:'Create improvement plan',exact:true})).toBeFocused()
  await p.getByRole('button',{name:'Create improvement plan',exact:true}).click();await target.fill('A different private target')
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tenaceiq:navigate',{detail:{href:'/coach'}})))
  await p.getByRole('button',{name:'Leave plan',exact:true}).click();await expect(p).toHaveCount(0);await expect(page.locator('body')).toHaveAttribute('data-screen','coach')
  expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
})

test('plan cancellation removes private fields and ignores an old discard after account change',async({page,server})=>{
  await open(page);const p=await plan(page);await p.getByRole('button',{name:'Create improvement plan',exact:true}).click()
  await p.getByRole('textbox',{name:'Measurable target',exact:true}).fill('Private court target for my account');await p.getByRole('button',{name:'Cancel new plan',exact:true}).click()
  await p.getByRole('button',{name:'Discard new plan',exact:true}).evaluate(button=>{if(!(button instanceof HTMLButtonElement))throw Error('Expected a discard button');(window as unknown as {oldPlanDiscard:HTMLButtonElement}).oldPlanDiscard=button})
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner())
  await expect(p).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Private court target for my account')
  await page.evaluate(()=>(window as unknown as {oldPlanDiscard:HTMLButtonElement}).oldPlanDiscard.click())
  await expect(page.locator('body')).toHaveAttribute('data-screen','lab');await expect(p).toHaveCount(0)
  expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
})

test('plan cancellation discards only the current draft and starts the next one cleanly',async({page,server})=>{
  await open(page);const p=await plan(page);await p.getByRole('button',{name:'Create improvement plan',exact:true}).click()
  const target=p.getByRole('textbox',{name:'Measurable target',exact:true}),sessions=p.getByLabel('Practices',{exact:true}),baseline=p.getByLabel('Starting assessment')
  const initial=await target.inputValue();await target.fill('Do not carry this target forward');await sessions.fill('')
  await p.getByRole('button',{name:'Cancel new plan',exact:true}).click();await p.getByRole('button',{name:'Discard new plan',exact:true}).click();await expect(p.getByRole('button',{name:'Create improvement plan',exact:true})).toBeFocused()
  await p.getByRole('button',{name:'Create improvement plan',exact:true}).click();await expect(target).toHaveValue(initial);await expect(sessions).toHaveValue('3');await expect(baseline).toHaveValue(growthId(1))
  await p.getByRole('button',{name:'Cancel new plan',exact:true}).click();await expect(p.getByRole('button',{name:'Create improvement plan',exact:true})).toBeFocused();expect((await server.db.query('select * from my_lab_goals')).rows).toHaveLength(0)
})

test('keeps incomplete edits through a close decision and never treats a failed read as an empty plan',async({page,server})=>{
  await open(page);const p=await plan(page);await p.getByRole('button',{name:'Create improvement plan'}).click();await p.getByLabel('Measurable target').fill('');await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('button',{name:'Keep editing'}).click();await expect(p.getByLabel('Measurable target')).toHaveValue('')
  await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('button',{name:'Leave plan',exact:true}).click();server.failRead=true
  const failed=await plan(page);await expect(failed).toContainText('couldn’t be confirmed');await expect(failed.getByRole('button',{name:'Create improvement plan'})).toHaveCount(0)
})
test('does not show a deleted assessment as a cached plan baseline',async({page,server})=>{
  await open(page);const p=await create(page);await server.db.query('delete from private.tiq_self_assessments where owner_id=$1 and id=$2',[growthPlayer,growthId(1)]);await p.getByRole('button',{name:'Refresh plan',exact:true}).click();await expect(p).toContainText('Baseline · Assessment removed')
})
test('offers explicit recovery from unreadable device retry details without hiding the account plan',async({page})=>{
  await page.addInitScript(owner=>localStorage.setItem('tiq-growth-pending:v1:'+owner,'corrupted'),growthPlayer)
  await open(page);const p=await plan(page);await expect(p).toContainText('Device retry details couldn’t load');await expect(p.getByRole('button',{name:'Create improvement plan'})).toBeDisabled();await p.getByRole('button',{name:'Discard retry and refresh'}).click();await expect(p.getByRole('button',{name:'Create improvement plan'})).toBeEnabled()
})
test('returns from retaking an assessment to finish a plan without inflating TiQ from practice',async({page})=>{
  await open(page);let p=await create(page);await p.getByRole('button',{name:'Retake self-assessment',exact:true}).click()
  const card=page.locator('.lab-starter-tiq')
  for(let step=0;step<2;step++){for(const select of await card.getByRole('combobox').all())await select.selectOption('2');await card.getByRole('button',{name:'Continue',exact:true}).click()}
  await card.getByRole('button',{name:'Save to my account',exact:true}).click();await expect(card).toContainText('Saved to your account')
  p=await plan(page);const select=p.getByLabel('New self-assessment');const value=await select.locator('option').last().getAttribute('value');await select.selectOption(value!);await p.getByRole('button',{name:'Review completed plan'}).click();await p.getByRole('button',{name:'Confirm review',exact:true}).click();await expect(p).toContainText('Reviewed plan');await expect(p.getByRole('button',{name:'Review practice log'})).toHaveCount(0);await expect(p).toContainText('0 / 3 practices')
})

test('guides the next practice and protects an unfinished court note from navigation',async({page},info)=>{
  await open(page);const d=await create(page),next=d.getByRole('region',{name:'Next practice step',exact:true})
  await expect(next.getByRole('button',{name:'Start this drill'})).toBeEnabled()
  await expect(d.getByRole('button',{name:'Open Serve Target Call',exact:true})).toHaveCount(0)
  await d.screenshot({path:info.outputPath('guided-practice-next.png')})
  await next.getByRole('button',{name:'Start this drill'}).click()
  const training=page.getByRole('dialog',{name:'Level Up training',exact:true});await expect(training.getByRole('heading',{name:'Serve Target Call',exact:true})).toBeVisible()
  await expect(training.locator('[data-growth-practice-return]')).toContainText('7 of 10 second serves in')
  await training.getByRole('button',{name:'Back to plan',exact:true}).click();await expect(d.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled()
  const note=d.getByLabel('What happened on court?');await note.fill('7/10 with a smooth second serve')
  await expect(next.getByRole('button')).toBeDisabled()
  await expect(d.getByRole('button',{name:'Retake self-assessment',exact:true})).toBeDisabled()
  await d.getByRole('button',{name:'Close',exact:true}).click();await d.getByRole('button',{name:'Keep editing'}).click();await expect(note).toHaveValue('7/10 with a smooth second serve')
  await d.getByRole('button',{name:'Review practice log'}).click();await d.getByRole('button',{name:'Confirm practice'}).click()
  await next.getByRole('button',{name:'Log next practice'}).click();await expect(note).toBeFocused()
  await expect(d).toContainText('1 / 3');await expect(d.getByRole('button',{name:'Review completed plan'})).toBeDisabled()
  await note.fill('Another unfinished note');await expect(d.getByRole('button',{name:'Open Serve Target Call',exact:true})).toBeDisabled()
})

for(const width of [320,390])test('returns a confirmed training session to the same plan for explicit logging at '+width+'px',async({page,server},info)=>{
  await page.setViewportSize({width,height:844});await open(page,width===320);let d=await create(page)
  await d.getByRole('button',{name:'Start this drill'}).click();const training=page.getByRole('dialog',{name:'Level Up training',exact:true})
  await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('3')
  const original=width===320?'Court note '.repeat(25):'7/10 second serves in with a smooth finish'
  await training.getByLabel('Your training note',{exact:true}).fill(original)
  expect(await training.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await training.screenshot({path:info.outputPath('plan-drill-'+width+'.png')})
  if(width===390)server.loseTrainingReply=true
  await training.getByRole('button',{name:'Save completed session'}).click()
  if(width===390){await expect(training).toContainText('Check whether this session saved');await training.getByRole('button',{name:'Check whether this session saved',exact:true}).click()}
  await expect(training.getByRole('button',{name:'Review practice for plan'})).toBeVisible()
  const records=(await server.request({owner:growthPlayer,method:'GET',url:'https://www.tenaceiq.com/api/player/level-up-sessions',write:null})).body as {sessions:{id:string}[]}
  expect(records.sessions).toHaveLength(1)
  const stored=async()=>(await server.db.query<{payload:{id:string;logs:{id:string;note:string}[]}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows[0].payload
  const before=await stored();expect(before.logs).toHaveLength(0)
  if(width===390)server.failRead=true
  await training.getByRole('button',{name:'Review practice for plan'}).click();d=page.getByRole('dialog',{name:'My improvement plan',exact:true})
  if(width===390){await expect(d).toContainText('couldn’t be confirmed');await expect(d.getByLabel('What happened on court?')).toHaveCount(0);server.failRead=false;await d.getByRole('button',{name:'Refresh plan',exact:true}).click()}
  await expect(d.getByLabel('What happened on court?')).toHaveValue(original.trim().slice(0,160));await expect(d.getByLabel('What happened on court?')).toBeFocused()
  await expect(d.getByRole('heading',{name:'Review saved practice',exact:true})).toBeVisible()
  expect((await stored()).id).toBe(before.id);expect((await stored()).logs).toHaveLength(0)
  await d.getByLabel('What happened on court?').fill('')
  await expect(d.getByRole('button',{name:'Start this drill',exact:true})).toBeDisabled()
  await expect(d.getByRole('button',{name:'Retake self-assessment',exact:true})).toBeDisabled()
  await expect(d.getByRole('button',{name:'Refresh plan',exact:true})).toBeDisabled()
  await d.getByLabel('What happened on court?').fill('Reviewed result: 7/10 second serves in')
  expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await d.screenshot({path:info.outputPath('practice-return-'+width+'.png')})
  await d.getByRole('button',{name:'Review practice log'}).click();await d.getByRole('button',{name:'Back to plan',exact:true}).click()
  await expect(d.getByLabel('What happened on court?')).toHaveValue('Reviewed result: 7/10 second serves in');await expect(d.getByRole('button',{name:'Refresh plan',exact:true})).toBeDisabled()
  await d.getByRole('button',{name:'Review practice log'}).click();if(width===320)server.loseReply=true
  await d.getByRole('button',{name:'Confirm practice',exact:true}).click()
  if(width===320){await expect(d).toContainText('Retry the same update');await page.reload();d=await plan(page);await d.getByRole('button',{name:'Retry pending update'}).click()}
  await expect(d).toContainText('1 / 3');expect((await stored()).logs).toEqual([{id:records.sessions[0].id.replace(/^level-up-/,''),date:expect.any(String),note:'Reviewed result: 7/10 second serves in'}])
  expect((await server.db.query('select id from private.tiq_self_assessments where owner_id=$1',[growthPlayer])).rows).toHaveLength(1)
})

test('returns to the original plan when it is archived during a drill and never logs to its replacement',async({page,server})=>{
  await open(page);const d=await create(page)
  const original=(await server.db.query<{payload:{id:string;revision:string;baseline:string;block:unknown}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows[0].payload
  await d.getByRole('button',{name:'Start this drill'}).click()
  for(const change of [{kind:'archive',id:original.id,operation:growthId(40),expected:original.revision},
    {kind:'new',id:growthId(41),operation:growthId(42),expected:null,baseline:original.baseline,block:original.block,sourceAssignment:null}]){
    expect((await server.db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[growthPlayer,JSON.stringify(change)])).rows[0].s).toBe(200)
  }
  await page.getByRole('dialog',{name:'Level Up training'}).getByRole('button',{name:'Back to plan',exact:true}).click()
  await expect(d).toContainText('Archived plan');await expect(d.getByLabel('What happened on court?')).toHaveCount(0)
  await expect(d.getByRole('button',{name:'Open active plan'})).toBeVisible()
  expect((await server.db.query<{logs:unknown[]}>('select payload->\'logs\' logs from my_lab_goals where user_id=$1',[growthPlayer])).rows.every(row=>row.logs.length===0)).toBe(true)
})

test('keeps an unfinished drill until discard is confirmed and returns without inventing practice',async({page,server})=>{
  await open(page);const d=await create(page);await d.getByRole('button',{name:'Start this drill'}).click()
  const training=page.getByRole('dialog',{name:'Level Up training'});await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByLabel('Your training note',{exact:true}).fill('Unsaved court work')
  await training.getByRole('button',{name:'Back to plan',exact:true}).click();await training.getByRole('button',{name:'Keep training'}).click();await expect(training.getByLabel('Your training note',{exact:true})).toHaveValue('Unsaved court work')
  await training.getByRole('button',{name:'Back to plan',exact:true}).click();await training.getByRole('button',{name:'Discard and close',exact:true}).click()
  await expect(d.getByRole('button',{name:'Refresh plan',exact:true})).toBeEnabled();await expect(d.getByLabel('What happened on court?')).toHaveValue('');await expect(d).toContainText('0 / 3')
  expect((await server.db.query('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows).toHaveLength(1)
})

test('clears the drill target on account change without reopening the previous player plan',async({page})=>{
  await open(page);const target='Private target for this player only',d=await create(page,3,target);await d.getByRole('button',{name:'Start this drill'}).click()
  const training=page.getByRole('dialog',{name:'Level Up training'});await expect(training).toContainText(target)
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner())
  await expect(training).toHaveCount(0);await expect(page.getByRole('dialog',{name:'My improvement plan'})).toHaveCount(0);await expect(page.locator('body')).not.toContainText(target)
})

for(const width of [320,390])test('previews the selected skill before finishing and keeps removed assessments private at '+width+'px',async({page,server},info)=>{
  await page.setViewportSize({width,height:844});await open(page,width===320);const d=await create(page,1)
  await d.getByLabel('What happened on court?').fill('7 second serves in');await d.getByRole('button',{name:'Review practice log'}).click();await d.getByRole('button',{name:'Confirm practice'}).click()
  await expect(d.getByRole('region',{name:'Next practice step'})).toContainText('Your planned practices are logged')
  await server.assess(growthPlayer,21,{serve:3})
  await d.getByRole('button',{name:'Refresh plan',exact:true}).click();await d.getByRole('button',{name:'Preview progress review'}).click()
  const review=d.getByRole('region',{name:'Serve practice review',exact:true})
  await expect(review).toContainText('Higher self-rating');await expect(review.locator('time')).toHaveCount(2)
  await expect(review).toContainText('Steady');await expect(review).toContainText('Under pressure')
  expect((await server.db.query<{payload:{state:string}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows[0].payload.state).toBe('active')
  expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await d.screenshot({path:info.outputPath('guided-review-'+width+'.png')})
  await d.getByRole('button',{name:'Confirm review',exact:true}).click();await expect(d).toContainText('Reviewed plan');await expect(review).toContainText('Higher self-rating')
  await expect(d.getByRole('region',{name:'Next practice step'})).toHaveCount(0)
  await server.db.query('delete from private.tiq_self_assessments where owner_id=$1 and id=$2',[growthPlayer,growthId(1)])
  await d.getByRole('button',{name:'Refresh plan',exact:true}).click();await expect(review).toContainText('Comparison unavailable');await expect(review).not.toContainText('Higher self-rating')
})
test('launch usability: new email signup through the first saved assessment and practice',async({page,server},info)=>{
  await server.db.query('delete from private.tiq_self_assessments where owner_id=$1',[growthPlayer])
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/?tiq-growth=1&signedOut=1&unlinked=1&launch-audit=1')
  await page.getByRole('button',{name:'Sign in or join',exact:true}).click();await page.getByRole('button',{name:'Create account or use an email code',exact:true}).click()
  await page.getByLabel('Email',{exact:true}).fill('new-tennis-player@example.test');await page.getByRole('checkbox').check();await page.screenshot({path:info.outputPath('audit-player-01-email-signup.png')});await page.getByRole('button',{name:'Send sign-in code',exact:true}).click();await page.getByLabel('Verification code').fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click()
  const card=page.locator('.lab-starter-tiq');await card.getByRole('button',{name:'Find my level',exact:true}).click();await card.screenshot({path:info.outputPath('audit-player-02-first-assessment.png')})
  for(let step=0;step<2;step++){for(const select of await card.getByRole('combobox').all())await select.selectOption('2');await card.getByRole('button',{name:'Continue',exact:true}).click()}
  await card.getByRole('button',{name:'Save to my account',exact:true}).click();await expect(card).toContainText('Saved to your account');await card.screenshot({path:info.outputPath('audit-player-03-saved-rating.png')});await card.locator('[data-starter-drill]').click()
  const training=page.getByRole('dialog',{name:'Level Up training',exact:true});await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('4');await training.screenshot({path:info.outputPath('audit-player-04-first-practice.png')});await training.getByRole('button',{name:'Save completed session',exact:true}).click();await expect(training).toContainText(/saved/i);expect(await training.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
})
