import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import path from 'node:path'
import {readFile} from 'node:fs/promises'

let bundle:Promise<{js:string;css:string}>|null=null
function fixtureBundle(){
 return bundle??=build({entryPoints:['tests/fixtures/partner-workbench.tsx'],bundle:true,write:false,outfile:'partner-workbench.js',platform:'browser',format:'esm',jsx:'automatic',external:['/brand/*'],loader:{'.module.css':'local-css'},alias:{'@/app/components/auth-provider':path.resolve('tests/fixtures/partner-workbench-environment.tsx'),'@/lib/supabase':path.resolve('tests/fixtures/partner-workbench-environment.tsx'),'next/navigation':path.resolve('tests/fixtures/partner-workbench-environment.tsx'),'next/link':path.resolve('tests/fixtures/partner-workbench-environment.tsx')},define:{'process.env.NODE_ENV':'"test"','process.env':'{}'}}).then(result=>({js:result.outputFiles.find(file=>file.path.endsWith('.js'))!.text,css:result.outputFiles.find(file=>file.path.endsWith('.css'))!.text}))
}
async function openWorkbench(page:Page,query=''){
 const assets=await fixtureBundle(),outside:string[]=[],errors:string[]=[]
 page.on('pageerror',error=>{errors.push(error.message);console.error('Workbench fixture page error: '+error.message)});await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4283'){outside.push(url.origin);return route.abort()}
  if(url.pathname==='/partner-workbench.js')return route.fulfill({contentType:'text/javascript',body:assets.js})
  if(url.pathname==='/partner-workbench.css')return route.fulfill({contentType:'text/css',body:assets.css})
  if(url.pathname.startsWith('/brand/')){const file=path.resolve('public','.'+url.pathname);expect(file.startsWith(path.resolve('public/brand')+path.sep)).toBe(true);return route.fulfill({contentType:'image/png',body:await readFile(file)})}
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/partner-workbench.css"></head><body><div id="fixture"></div><script type="module" src="/partner-workbench.js"></script></body></html>'})
 })
 await page.goto('http://127.0.0.1:4283/?card=return-1-conditioning'+query);await expect(page.locator('#direct-execution-title')).toHaveText('Return +1 Conditioning');await expect(page.locator('#direct-execution-title')).toBeVisible();return {outside,errors}
}
test.describe('Website partner practice handoff',()=>{
 test('starts the selected conditioning card with partner setup and keeps it while changing context',async({page})=>{
  const {outside,errors}=await openWorkbench(page)
  await expect(page.locator('[aria-label="Current Level Up path"] p')).toHaveText('Body & conditioning / With a partner')
  await page.getByRole('button',{name:'Change rep',exact:true}).click()
  await page.locator('[aria-label="Choose a training focus"]').getByRole('button',{name:'Return',exact:true}).click()
  await page.getByRole('button',{name:/^Body & conditioning/}).click()
  const setup=page.getByRole('group',{name:'Choose training setup',exact:true});await expect(setup).toBeVisible();await expect(setup).toHaveAccessibleDescription(/This drill uses a partner/)
  await setup.getByRole('button',{name:'Training alone',exact:true}).click();await expect(page.locator('#direct-execution-title')).toHaveText('Return +1 Conditioning');await expect(page.locator('#direct-execution-title')).toBeVisible();await expect(page.locator('[aria-label="Current Level Up path"] p')).toHaveText('Body & conditioning / Training alone');expect(outside).toEqual([]);expect(errors).toEqual([])
 })
 test('opens an older solo repeat on the same conditioning card',async({page})=>{
  const {outside,errors}=await openWorkbench(page,'&workType=physical&context=alone')
  await expect(page.locator('[aria-label="Current Level Up path"] p')).toHaveText('Body & conditioning / Training alone');expect(outside).toEqual([]);expect(errors).toEqual([])
 })
})
