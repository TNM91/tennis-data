import {test,expect} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
const origin='http://127.0.0.1:4259',prefix='/__apple-membership-fixture/'
let javascript='',stylesheet=''
test.beforeAll(async()=>{
 const bundled=await build({entryPoints:['tests/fixtures/mobile-apple-memberships.ts'],bundle:true,platform:'browser',format:'esm',outfile:'apple-membership-fixture.js',loader:{'.module.css':'local-css'},jsx:'automatic',write:false})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['mobile/src/style.css','mobile/src/website-parity.css'].map(file=>readFile(file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body><main><p>QA fixture · no account or live purchase</p><section id="membership" class="apple-membership-panel"></section></main><script type="module" src="./app.js"></script></body></html>'})
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
