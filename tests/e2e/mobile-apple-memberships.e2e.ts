import {test,expect} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
const origin='http://127.0.0.1:4259',prefix='/__apple-membership-fixture/'
let javascript='',stylesheet=''
test.beforeAll(async()=>{
 const bundled=await build({stdin:{resolveDir:process.cwd(),sourcefile:'apple-membership-fixture.ts',loader:'ts',contents:`
 import {mountAppleMemberships} from './mobile/src/apple-memberships';
 import {AppleProductError} from './mobile/src/apple-product-catalog';
 import {APPLE_MEMBERSHIP_PRODUCTS} from './lib/apple-membership-products';
 const mode=new URL(location.href).searchParams.get('mode');
 const state={productCalls:0,buyCalls:0,restoreCalls:0,manageCalls:0};
 (window as any).membershipFixture=state;
 const rows=APPLE_MEMBERSHIP_PRODUCTS.map((p,i)=>({...p,price:i?'$4.99':'$1.99'}));
 const service={available:true,isIos:true,context:async()=>({enabled:true,environment:'Sandbox',canPurchase:true,webAccess:false,activeProductId:null}),
 products:async()=>{state.productCalls++;if(mode==='failed'&&state.productCalls===1)throw new AppleProductError('products_request_failed','NSURLErrorDomain:-1009');return mode==='partial'?rows.slice(0,1):rows},
 purchase:async()=>{state.buyCalls++;return 'cancelled'},recover:async()=>0,restore:async()=>{state.restoreCalls++;return 0},manage:async()=>{state.manageCalls++},subscribe:()=>()=>{}};
 mountAppleMemberships(document.querySelector('#membership')!,{} as never,'synthetic-owner',()=>true,()=>{},service as never);
 `},bundle:true,platform:'browser',format:'esm',write:false})
 javascript=bundled.outputFiles[0].text
 stylesheet=(await Promise.all(['mobile/src/style.css','mobile/src/website-parity.css'].map(file=>readFile(file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body><main><p>QA fixture · no account or live purchase</p><section id="membership" class="apple-membership-panel"></section></main><script type="module" src="./app.js"></script></body></html>'})
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
