import {test,expect} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
const origin='http://127.0.0.1:4259',prefix='/__apple-membership-fixture/'
let javascript='',accountJavascript='',stylesheet=''
test.beforeAll(async()=>{
 const bundled=await build({entryPoints:['tests/fixtures/mobile-apple-memberships.ts'],bundle:true,platform:'browser',format:'esm',outfile:'apple-membership-fixture.js',loader:{'.module.css':'local-css'},jsx:'automatic',write:false})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 const account=await build({entryPoints:['tests/fixtures/mobile-account-logout.ts'],bundle:true,platform:'browser',format:'esm',outfile:'account.js',jsx:'automatic',write:false});accountJavascript=account.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['mobile/src/style.css','mobile/src/website-parity.css'].map(file=>readFile(file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin==='https://www.tenaceiq.com'&&['/api/mobile/account','/api/auth/access'].includes(url.pathname)){
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,OPTIONS'}
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''})
   if(route.request().method()!=='GET')return route.abort()
   if(url.pathname==='/api/mobile/account')return route.fulfill({status:page.url().includes('account-load-error')?503:200,headers,contentType:'application/json',body:JSON.stringify({ok:true,email:'paid-test@example.test',reviewDays:7,fulfillment:'automated',verificationRequired:false,request:null})})
   const captain=page.url().includes('account-captain')
   return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({ok:true,access:{role:'member',entitlements:{playerPlusSubscriptionActive:true,coachSubscriptionActive:false,captainSubscriptionActive:captain,tiqTeamLeagueEntryEnabled:false,tiqIndividualLeagueCreatorEnabled:false,playerPlusSubscriptionStatus:'active',coachSubscriptionStatus:'inactive',captainSubscriptionStatus:captain?'active':'inactive',playerPlusAccessExpiresAt:null,coachAccessExpiresAt:null,captainAccessExpiresAt:null,leagueAccessExpiresAt:null}}})})
  }
  if(url.pathname.endsWith('account.js')&&url.origin===origin)return route.fulfill({contentType:'text/javascript',body:accountJavascript})
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body><main><p>QA fixture · no account or live purchase</p><section id="membership" class="apple-membership-panel"></section></main><script type="module" src="./'+(url.searchParams.get('mode')?.startsWith('account-')?'account.js':'app.js')+'"></script></body></html>'})
 })
})
for(const width of [320,390])test(`plan errors and retry stay usable at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:844})
 await page.goto(origin+prefix+'?mode=failed')
 await expect(page.getByRole('heading',{name:'Plans couldn’t load'})).toBeVisible()
 await expect(page.getByText('Apple could not load membership prices. Check your connection, then try again.')).toBeVisible()
 await expect(page.getByRole('button',{name:'Subscribe',exact:false})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Manage Apple subscriptions'})).not.toBeVisible()
 const retry=page.getByRole('button',{name:'Retry loading plans'}),bounds=await retry.boundingBox()
 expect(bounds).toBeTruthy();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.getByText('Details for support',{exact:true}).click()
 await expect(page.getByText('NSURLErrorDomain:-1009',{exact:true})).toBeVisible()
 await page.screenshot({path:info.outputPath('apple-membership-unavailable.png'),fullPage:true})
 await retry.click()
 await expect(page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Subscribe · $4.99/month',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Plans couldn’t load'})).toHaveCount(0)
 await page.screenshot({path:info.outputPath('apple-membership-plans.png'),fullPage:true})
 await page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true}).click()
 await expect(page.getByText('Purchase canceled.',{exact:true})).toBeVisible()
 expect(await page.evaluate(()=>(window as unknown as {membershipFixture:{buyCalls:number;restoreCalls:number;manageCalls:number}}).membershipFixture)).toMatchObject({buyCalls:1,restoreCalls:0,manageCalls:0})
 await page.getByText('Already subscribed?',{exact:true}).click()
 await page.getByRole('button',{name:'Restore purchases',exact:true}).click()
 await expect(page.getByText('No Apple memberships were found. Check the Apple Account used for the original purchase.')).toBeVisible()
 expect(await page.evaluate(()=>(window as unknown as {membershipFixture:{restoreCalls:number}}).membershipFixture.restoreCalls)).toBe(1)
})
test('one returned plan remains purchasable without inventing the missing plan price',async({page})=>{
 await page.goto(origin+prefix+'?mode=partial')
 await expect(page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Subscribe · $4.99/month',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Check other plans',exact:true})).toBeVisible()
})

for(const width of [320,390]){
 for(const mode of ['history-timeout','prepare-timeout'])test(`${mode} keeps preparation errors retryable at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?mode='+mode);const buy=page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true});await buy.click();await expect(page.getByText('No new purchase was started.',{exact:false})).toBeVisible();await expect(buy).toBeEnabled();await expect(page.getByRole('button',{name:'Close account settings',exact:true})).toBeEnabled();await page.getByText('Details for support',{exact:true}).click();await expect(page.getByText(mode==='history-timeout'?'purchase_history_timeout':'purchase_preparation_timeout',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('apple-membership-'+mode+'.png'),fullPage:true});
  const before=await page.evaluate(()=>(window as unknown as {membershipFixture:{buyCalls:number;prepareCalls:number;finishCalls:number;reconcileCalls:number}}).membershipFixture);expect(before.buyCalls).toBe(mode==='history-timeout'?0:1);expect(before.reconcileCalls).toBe(0);expect(before.finishCalls).toBe(0)
  await buy.click();await expect(page.getByText('Purchase canceled.',{exact:true})).toBeVisible()
 })
 test(`an unresolved confirmation keeps close usable and blocks a second purchase after reopening at ${width}px`,async({page},info)=>{
  await page.clock.install();await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?mode=stalled');const buy=()=>page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true});await buy().click();await expect(page.getByText('Opening Apple. Sign in if asked…',{exact:true})).toBeVisible();await page.clock.fastForward(60000);await expect(page.getByText('Apple is taking longer than expected.',{exact:false})).toBeVisible();await expect(buy()).toBeDisabled();await expect(page.getByRole('button',{name:'Close account settings',exact:true})).toBeEnabled();await page.screenshot({path:info.outputPath('apple-membership-waiting-confirmation.png'),fullPage:true})
  await page.getByRole('button',{name:'Close account settings',exact:true}).click();await page.getByRole('button',{name:'Reopen account settings',exact:true}).click();await buy().click();await expect(page.getByText('An Apple purchase is still open or being checked.',{exact:false})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as {membershipFixture:{buyCalls:number;prepareCalls:number}}).membershipFixture)).toMatchObject({buyCalls:1,prepareCalls:1})
  await page.evaluate(()=>(window as unknown as {membershipFixture:{releasePurchase:(v:string)=>void}}).membershipFixture.releasePurchase('cancelled'));await page.getByRole('button',{name:'Sync purchase',exact:true}).click();await expect(page.getByText('No unfinished purchase was found.',{exact:false})).toBeVisible();await expect(buy()).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 })
}
test('an unknown purchase result opens recovery and keeps new purchases locked until explicit sync',async({page})=>{
 await page.goto(origin+prefix+'?mode=unknown-result');const buy=page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true});await buy.click();await expect(page.getByText('Apple did not confirm the purchase result.',{exact:false})).toBeVisible();await expect(buy).toBeDisabled();await expect(page.getByRole('button',{name:'Sync purchase',exact:true})).toBeVisible();await expect(page.locator('main')).not.toContainText('Private Apple account text');await page.getByRole('button',{name:'Sync purchase',exact:true}).click();await expect(buy).toBeEnabled()
})

for(const width of [320,390])for(const mode of ['native-preparation-error','native-confirmation-error'])test(`${mode} shows private-safe diagnostics at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?mode='+mode);const buy=page.getByRole('button',{name:'Subscribe · $1.99/month',exact:true});await buy.click();await page.getByText('Details for support',{exact:true}).click();await expect(page.getByText('Build 168',{exact:false})).toBeVisible();await expect(page.getByText(mode==='native-preparation-error'?'app_receipt/NSURLErrorDomain:-1009':'confirmation/StoreKit.StoreKitError:0/ASDErrorDomain:500',{exact:false})).toBeVisible();await expect(page.locator('main')).not.toContainText('Private Apple account text');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const state=await page.evaluate(()=>(window as unknown as {membershipFixture:{buyCalls:number;prepareCalls:number;finishCalls:number;reconcileCalls:number}}).membershipFixture);expect(state).toMatchObject({buyCalls:1,prepareCalls:1,finishCalls:0,reconcileCalls:0});
 if(mode==='native-preparation-error'){await expect(page.getByText('No new purchase was started.',{exact:false})).toBeVisible();await expect(buy).toBeEnabled()}else{await expect(buy).toBeDisabled();await expect(page.getByText('No new purchase was started.',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Sync purchase',exact:true})).toBeVisible()}
 await page.screenshot({path:info.outputPath('apple-membership-'+mode+'.png'),fullPage:true})
})

for(const width of [320,390])test('restore failure preserves active membership and stays retryable at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?mode=restore-failure');await expect(page.getByText('Your Apple membership is active.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Restore purchases',exact:true}).click();await expect(page.getByText('Apple couldn’t refresh your memberships.',{exact:false})).toBeVisible();await expect(page.getByText('Your Apple membership is active.',{exact:false})).toBeVisible();await expect(page.getByText('Apple did not confirm the purchase result.',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Subscribe',exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Close account settings',exact:true})).toBeEnabled();await page.getByText('Details for support',{exact:true}).click();await expect(page.getByText('restore/StoreKit.StoreKitError:2',{exact:false})).toBeVisible();await expect(page.locator('main')).not.toContainText('Private Apple account text');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('apple-restore-failure.png'),fullPage:true});expect(await page.evaluate(()=>(window as unknown as {membershipFixture:{restoreCalls:number;buyCalls:number;finishCalls:number;reconcileCalls:number}}).membershipFixture)).toMatchObject({restoreCalls:1,buyCalls:0,finishCalls:0,reconcileCalls:0})
 await page.getByRole('button',{name:'Restore purchases',exact:true}).click();await expect(page.getByText('Your Apple purchases are restored.',{exact:true})).toBeVisible();await expect(page.getByText('Your Apple membership is active.',{exact:false})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as {membershipFixture:{restoreCalls:number;buyCalls:number;finishCalls:number;reconcileCalls:number}}).membershipFixture)).toMatchObject({restoreCalls:2,buyCalls:0,finishCalls:1,reconcileCalls:1});await page.screenshot({path:info.outputPath('apple-restore-success.png'),fullPage:true})
})

async function openAccount(page:import('@playwright/test').Page,mode='account-ready'){
 await page.goto(origin+prefix+'?mode='+mode);await page.getByRole('button',{name:'Account settings',exact:true}).click();return page.getByRole('dialog',{name:'Account settings',exact:true})
}
for(const width of [320,390])test('Account logout stays visible and returns to login at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:568});const d=await openAccount(page),logout=d.getByRole('button',{name:'Log out',exact:true});await expect(d).toContainText('paid-test@example.test');await expect(d.locator('.account-access-badge')).toHaveText('Available');const box=await logout.boundingBox();expect(box!.y+box!.height).toBeLessThan(568);await page.addStyleTag({content:':root{font-size:22px!important}'});expect(await d.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await page.screenshot({path:info.outputPath('apple-membership-account-logout.png')});await logout.click();await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();await expect(d).toHaveCount(0);expect(await page.evaluate(()=>(window as unknown as {accountLogoutFixture:{state:{events:string[];scopes:string[]}}}).accountLogoutFixture.state)).toMatchObject({events:['cleanup','logout'],scopes:['local']})
})
for(const width of [320,390])test('Captain account shows one access tier with included Player tools at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:568});const d=await openAccount(page,'account-captain')
 await expect(d.locator('.account-tool-access li')).toHaveCount(1)
 await expect(d.locator('.account-tool-access li strong')).toHaveText('Captain')
 await expect(d).toContainText('Player tools are included with Captain.')
 await page.addStyleTag({content:':root{font-size:22px!important}'})
 expect(await d.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('account-captain-included-player.png')})
 await d.getByRole('button',{name:'Log out',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible()
})
for(const mode of ['account-cleanup-error','account-auth-error'])test('Account logout safely retries '+mode,async({page})=>{
 const d=await openAccount(page,mode);await d.getByRole('button',{name:'Log out',exact:true}).click();await expect(d.locator('[data-account-logout-error]')).toHaveText('Couldn’t log out. Check your connection and try again.');await expect(d.locator('[data-account-logout-error]')).toBeFocused();await expect(d.getByRole('button',{name:'Delete account',exact:true})).toBeEnabled();await expect(d).not.toContainText('Private');expect(await page.evaluate(()=>(window as unknown as {accountLogoutFixture:{state:{owner:string}}}).accountLogoutFixture.state.owner)).toBeTruthy();await d.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible()
})
test('Account logout remains available when account details fail',async({page})=>{
 const d=await openAccount(page,'account-load-error');await expect(d).toContainText('Account settings could not be loaded');await d.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible()
})
test('Account can close during logout without duplicate actions or a stale error',async({page})=>{
 const d=await openAccount(page,'account-waiting');await d.getByRole('button',{name:'Log out',exact:true}).click();await expect(d.getByRole('button',{name:'Logging out…',exact:true})).toBeDisabled();await expect(d.locator('[aria-busy="true"]')).toHaveAttribute('inert','');await d.getByRole('button',{name:'Close account settings',exact:true}).click();await expect(d).toHaveCount(0);await page.evaluate(()=>(window as unknown as {accountLogoutFixture:{state:{release:()=>void}}}).accountLogoutFixture.state.release());await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as {accountLogoutFixture:{state:{cleanupCalls:number;logoutCalls:number}}}).accountLogoutFixture.state)).toMatchObject({cleanupCalls:1,logoutCalls:1})
})

test('Account logout works before a late settings response and ignores that response',async({page})=>{
 let pending:import('@playwright/test').Route|undefined
 await page.route('https://www.tenaceiq.com/api/mobile/account',route=>{if(route.request().method()==='GET'){pending=route;return}return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,OPTIONS'},body:''})})
 const d=await openAccount(page);await expect.poll(()=>!!pending).toBe(true);await expect(d).toContainText('Loading account settings');await d.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();await pending!.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,email:'paid-test@example.test',reviewDays:7,fulfillment:'automated',verificationRequired:false,request:null})});await expect(d).toHaveCount(0);await expect(page.locator('body')).not.toContainText('paid-test@example.test')
})
