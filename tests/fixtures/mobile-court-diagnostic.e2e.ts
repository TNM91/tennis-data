import {test,expect} from '@playwright/test'
import '../e2e/mobile-navigation.e2e'
test('Court geometry diagnostic',async({page},info)=>{
 await page.setViewportSize({width:320,height:568})
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1&large=1')
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training"]').click()
 const dialog=page.getByRole('dialog',{name:'Level Up training',exact:true})
 await dialog.getByRole('searchbox',{name:'Find a drill',exact:true}).fill('Return Depth Lane');await dialog.getByRole('button',{name:'Preview Return Depth Lane',exact:true}).click()
 await dialog.getByRole('combobox',{name:'Practice version',exact:true}).selectOption('pressure');await dialog.getByRole('button',{name:'Start training',exact:true}).click();await dialog.getByRole('button',{name:'On-court view',exact:true}).click()
 await dialog.evaluate(el=>{const d=el as HTMLElement;d.style.setProperty('--training-top-clearance','60px');d.style.setProperty('--training-bottom-clearance','36px');const title=d.querySelector<HTMLElement>('h1')!;title.style.fontSize='28px';title.style.maxInlineSize='120px'})
 const dump=async(label:string)=>{
  const metrics=await dialog.evaluate(el=>({viewport:{width:innerWidth,height:innerHeight,visual:visualViewport?.height,short:matchMedia('(max-height:640px)').matches,rootFont:getComputedStyle(document.documentElement).fontSize},nodes:[el,...el.querySelectorAll('header,h1,.training-session-clock,.training-session-clock>*,.training-clock-controls button,.training-court-tools,.training-court-body,.training-court-footer,[data-drill-result]')].map(n=>{const s=getComputedStyle(n);return {tag:n.tagName,class:n.className,text:n.textContent?.slice(0,80),box:n.getBoundingClientRect().toJSON(),font:s.fontSize,line:s.lineHeight,display:s.display,position:s.position,height:s.height,minHeight:s.minHeight,maxHeight:s.maxHeight,padding:s.padding,margin:s.margin,rows:s.gridTemplateRows,gap:s.gap,flex:s.flex}})}))
  console.log('COURT_GEOMETRY '+label+' '+JSON.stringify(metrics));await info.attach(label+'.json',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});await page.screenshot({path:info.outputPath(label+'.png')})
 }
 await expect(dialog.getByRole('button',{name:'Finish & log',exact:true})).toBeVisible();await dump('baseline')
 await dialog.getByRole('button',{name:'Rounds',exact:true}).click();await dump('rounds')
 await dialog.evaluate(el=>{const input=el.querySelector<HTMLInputElement>('[data-drill-result="2"]')!;input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}));input.scrollIntoView({block:'center'})});await dump('last-round')
 await dialog.evaluate(el=>{for(const n of el.querySelectorAll<HTMLElement>('.training-session-clock-head,[data-timer-hint]'))n.style.display='none';const clock=el.querySelector<HTMLElement>('.training-session-clock')!;clock.style.padding='8px 10px';clock.style.gap='4px 8px';for(const n of el.querySelectorAll<HTMLElement>('.training-clock-controls button'))n.style.fontSize='16px'});await dump('forced-compact')
})
