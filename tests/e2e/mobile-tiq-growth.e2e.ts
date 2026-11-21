import {test as base,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {growthServer,growthPlayer,growthPeer,growthId,type GrowthRequest} from '../fixtures/tiq-growth-server'
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
