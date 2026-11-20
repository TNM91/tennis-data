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
async function create(page:Page){const d=await plan(page);await d.getByRole('button',{name:'Create improvement plan',exact:true}).click();await d.getByLabel('Measurable target').fill('7 of 10 second serves in');await d.getByRole('button',{name:'Review plan',exact:true}).click();await d.getByRole('button',{name:'Save improvement plan',exact:true}).click();await expect(d.getByRole('button',{name:'Review practice log',exact:true})).toBeEnabled();return d}
async function workspace(page:Page){await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination=coach]').click();await page.getByRole('button',{name:'For coaches',exact:true}).click();await page.locator('[data-app-destination=coach-workspace]').click();return page.getByRole('dialog',{name:'Coach workspace',exact:true})}
async function alignment(page:Page){const w=await workspace(page);await w.getByRole('button',{name:/Alex Rivera/}).last().click();await w.getByRole('button',{name:'Coach assessments',exact:true}).click();await page.getByRole('button',{name:'Player & coach view',exact:true}).click();const d=page.getByRole('dialog',{name:'Player and coach view',exact:true});await expect(d.getByLabel('Player self-assessment')).toBeEnabled();return d}
test('keeps practice private and recovers a lost log reply after relaunch without duplicates',async({page,server},info)=>{
  await open(page);let d=await create(page)
  await d.getByLabel('What happened on court?').fill('7/10 second serves in');await d.getByRole('button',{name:'Review practice log',exact:true}).click();server.loseReply=true
  await d.getByRole('button',{name:'Confirm practice',exact:true}).click();await expect(d).toContainText('Retry the same update')
  await page.reload();d=await plan(page);await expect(d).toContainText('An update needs confirmation');await d.getByRole('button',{name:'Retry pending update'}).click();await expect(d).toContainText('1 / 3')
  const plans=(await server.db.query<{payload:{logs:unknown[]}}>('select payload from my_lab_goals where user_id=$1',[growthPlayer])).rows
  expect(plans[0].payload.logs).toHaveLength(1);expect((await server.db.query('select * from coach_assignments')).rows).toHaveLength(0)
  await d.screenshot({path:info.outputPath('private-improvement-plan.png')})
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
  await p.getByText('Coach practice blocks',{exact:true}).click();await p.getByRole('button',{name:'Use Serve practice block',exact:true}).click();await p.getByRole('button',{name:'Review plan',exact:true}).click();await p.getByRole('button',{name:'Save improvement plan',exact:true}).click();await expect(p).toContainText('8 of 10 second serves in')
  await p.getByLabel('What happened on court?').fill('8/10 in');await p.getByRole('button',{name:'Review practice log'}).click();await p.getByRole('button',{name:'Confirm practice'}).click();await expect(p).toContainText('1 / 3')
  await p.getByRole('button',{name:'Prepare coach check-in'}).click();const check=page.getByRole('dialog',{name:'Coach assignment check-in',exact:true});await expect(check.getByLabel('Your recap')).toHaveValue(/1 of 3 planned practices/);await check.getByRole('button',{name:'Review check-in'}).click();await check.screenshot({path:info.outputPath('audit-coach-03-check-in.png')});await check.getByRole('button',{name:'Send check-in',exact:true}).click();await expect(check).toHaveCount(0)
  const overview=(await server.db.query<{v:{counts:{feedback:number}}}>('select native_coach_growth_overview($1,$2) v',[growthPlayer,server.day])).rows[0].v;expect(overview.counts.feedback).toBe(1)
  expect((await server.db.query('select * from my_lab_goals where user_id=$1',[growthPeer])).rows).toHaveLength(1)
  await page.evaluate(()=>(window as unknown as {switchNavigationOwner:(restore:boolean)=>void}).switchNavigationOwner(true))
  const w=await workspace(page)
  await expect(w.locator('.tiq-growth-attention')).toContainText('1 awaiting feedback');await w.locator('[data-growth-attention]').first().click();await w.getByRole('button',{name:'Review player check-in',exact:true}).click();await w.getByLabel('Your feedback',{exact:true}).fill('Good target control. Keep the second serve smooth.');await w.getByLabel('Next tennis focus',{exact:true}).fill('Aim for eight serves in during pressure points.');await w.getByRole('button',{name:'Review feedback',exact:true}).click();await w.getByRole('button',{name:'Save feedback',exact:true}).click();await expect(w).toContainText('Saved to your Coach workspace.');await w.getByRole('button',{name:/^Serve practice block/}).click();await expect(w).toContainText('Good target control.');await w.screenshot({path:info.outputPath('audit-coach-04-reviewed-feedback.png')})
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
