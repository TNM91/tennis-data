import {test,expect,type Page} from '@playwright/test'

async function openReturn(page:Page,title:string,query=''){
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1'+query)
 await page.evaluate(()=>{
  const writes:string[]=[],original=window.fetch.bind(window);Object.assign(window,{returnDrillWrites:writes})
  window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.pathname==='/api/player/level-up-sessions'&&init?.method==='POST')writes.push(String(init.body));return original(input,init)}
 })
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training"]').click()
 const training=page.getByRole('dialog',{name:'Level Up training',exact:true});await training.getByRole('searchbox',{name:'Find a drill',exact:true}).fill(title);await training.getByRole('button',{name:'Preview '+title,exact:true}).click();return training
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as {returnDrillWrites:string[]}).returnDrillWrites)
const cases=[['Return Step-In Game','return-step-in-game','planned return starts',10,8],['Second-Serve Attack or Build','second-serve-attack-or-build','balanced return choices',6,4]] as const
test.describe('Return decision playbooks',()=>{
 for(const [title,id,label,reps,clean] of cases)for(const version of ['control','pressure'] as const)test('logs and repeats '+title+' · '+version,async({page})=>{
  const training=await openReturn(page,title);await training.getByRole('combobox',{name:'Practice version',exact:true}).selectOption(version)
  await expect(training.getByRole('region',{name:'Drill setup',exact:true})).toContainText(`3 rounds · ${reps} reps per round`)
  await training.getByText('Quick coaching',{exact:true}).click();await expect(training.locator('[data-drill-fold="coaching"]')).toContainText(id==='return-step-in-game'?'Hold or give yourself more time':'A balanced build or neutral return can count')
  await training.getByRole('button',{name:'Start training',exact:true}).click();await expect(training.getByRole('combobox',{name:'Training context',exact:true})).toHaveValue('partner');await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2')
  await training.getByRole('textbox',{name:'Your training note',exact:true}).fill('Keep the same serve pace.');await training.getByRole('button',{name:'On-court view',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click()
  await training.getByText('What counts?',{exact:true}).click();await expect(training.locator('.training-rounds')).toContainText(id==='return-step-in-game'?'Point wins are not counted.':'A neutral return can count.')
  await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill(String(clean));await training.getByRole('button',{name:'Finish & log',exact:true}).click();await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.locator('.training-history-latest')).toContainText(title);await training.getByRole('combobox',{name:'Drill',exact:true}).selectOption(id)
  const comparison=training.getByRole('region',{name:'Recent round results',exact:true});await expect(comparison).toContainText(`${clean} / ${reps*2} ${label}`);await expect(comparison.locator('.training-round-result-head>span')).toHaveText(Math.round(clean/(reps*2)*100)+'%')
  const saved=JSON.parse((await writes(page))[0]).session;expect(saved).toMatchObject({cardId:id,rating:2,context:'partner',sharedWithCoach:false});expect(saved.note).toContain(`R1 0/${reps}; R3 ${clean}/${reps}. Total ${clean}/${reps*2}.`);expect(saved.note).not.toContain('Quick coaching');expect(saved).not.toHaveProperty('assignmentId')
  await training.getByRole('button',{name:'Practice this drill again',exact:true}).click();await expect(training.getByRole('combobox',{name:'Practice version',exact:true})).toHaveValue(version);await training.getByRole('button',{name:'Start training',exact:true}).click()
  for(const field of await training.locator('[data-drill-result]').all())await expect(field).toHaveValue('');expect(await writes(page)).toHaveLength(1)
 })
 for(const [index,[title,,,reps,clean]] of cases.entries())test('keeps '+title+' through a short-phone unconfirmed save',async({page},info)=>{
  await page.setViewportSize({width:index===0?390:320,height:568});const training=await openReturn(page,title,'&training-session-lost-response=1'+(index===1?'&large=1':''))
  await training.getByRole('combobox',{name:'Practice version',exact:true}).selectOption('pressure');await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('button',{name:'On-court view',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click()
  const first=training.getByRole('spinbutton',{name:'Round 1',exact:true}),third=training.getByRole('spinbutton',{name:'Round 3',exact:true});await first.fill('0');await third.fill(String(clean));await third.press('Escape');await training.getByRole('button',{name:'Keep training',exact:true}).click()
  await expect(third).toBeFocused();await expect(third).toBeInViewport({ratio:1});expect(await third.evaluate(el=>{const rect=el.getBoundingClientRect();return document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===el})).toBe(true)
  await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toHaveValue('');await expect(training.getByRole('button',{name:'Finish & log',exact:true})).toBeInViewport({ratio:1});expect(await training.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:info.outputPath('return-decisions-short-phone.png')});await training.getByRole('button',{name:'Finish & log',exact:true}).click();await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('3');await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.getByRole('button',{name:'Check whether this session saved',exact:true})).toBeVisible();await expect(first).toBeDisabled();await expect(third).toHaveValue(String(clean));await training.getByRole('button',{name:'Check whether this session saved',exact:true}).click();await expect(training.locator('.training-history-latest')).toContainText(`R1 0/${reps}; R3 ${clean}/${reps}`);expect(await writes(page)).toHaveLength(1)
 })
})
