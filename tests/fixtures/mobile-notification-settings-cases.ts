import {test,expect,type Page} from '@playwright/test'

type Preview=Window&{nativeCoachAlertFixture:{writes:boolean[];appWrites:boolean[]};coachAlertFixture:{mount:()=>void;openExtra:()=>void;closeExtra:()=>void;hold:boolean;release:()=>void;registered:boolean;writes:boolean[]}}
async function start(page:Page,width=390,native=true){
 await page.routeWebSocket('**/*',ws=>ws.close())
 await page.setViewportSize({width,height:720})
 await page.goto('http://127.0.0.1:4283/?large=1'+(native?'&coachAlerts=1':''))
 await expect(page.locator('#app')).toHaveAttribute('data-state','ready')
}
async function settings(page:Page){
 await page.getByRole('button',{name:'Account settings',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Account settings',exact:true})
 await dialog.getByRole('button',{name:'Notifications',exact:true}).click()
 return dialog
}

for(const width of [320,390])test('Notification settings are reachable from My Lab without changing consent at '+width+'px',async({page},info)=>{
 await start(page,width)
 const appWrites=await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.appWrites)
 const dialog=await settings(page),section=dialog.getByRole('region',{name:'Notifications',exact:true})
 await expect(section).toBeFocused()
 await expect(section.getByRole('heading',{name:'Chat notifications',exact:true})).toBeInViewport()
 await expect(section.getByRole('button',{name:'Turn off chat notifications',exact:true})).toBeEnabled()
 await expect(section.getByRole('button',{name:'Turn on Coach alerts',exact:true})).toBeEnabled()
 expect(await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.writes)).toEqual([])
 expect(await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.appWrites)).toEqual(appWrites)
 await page.route('http://127.0.0.1:4283/notification-settings-large.css',route=>route.fulfill({contentType:'text/css',body:':root{font-size:24px!important}'}))
 await page.addStyleTag({url:'http://127.0.0.1:4283/notification-settings-large.css'})
 await dialog.getByRole('button',{name:'Notifications',exact:true}).click()
 await expect(section).toBeFocused()
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await expect(dialog.getByRole('button',{name:'Close account settings',exact:true})).toBeInViewport()
 await page.screenshot({path:info.outputPath('notification-settings-'+width+'.png')})
 await dialog.getByRole('button',{name:'Close account settings',exact:true}).click()
 await expect(page.getByRole('button',{name:'Account settings',exact:true})).toBeFocused()
})

test('Notification settings keep Coach choices synchronized with the existing Chats controls',async({page})=>{
 await start(page)
 await page.locator('.app-navigation [data-screen="teams"]').click()
 const inbox=page.locator('#app [data-coach-alerts]')
 await expect(inbox).toContainText('Coach alerts are off.')
 const dialog=await settings(page),section=dialog.getByRole('region',{name:'Notifications',exact:true})
 await section.getByRole('button',{name:'Turn on Coach alerts',exact:true}).click()
 await expect(section).toContainText('Coach alerts are on for your account.')
 await expect(inbox).toContainText('Coach alerts are on for your account.')
 await dialog.getByRole('button',{name:'Close account settings',exact:true}).click()
 await inbox.getByRole('button',{name:'Turn off Coach alerts',exact:true}).click()
 await expect(inbox).toContainText('Coach alerts are off.')
 const reopened=await settings(page)
 await expect(reopened.getByRole('region',{name:'Notifications',exact:true})).toContainText('Coach alerts are off.')
 expect(await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.writes)).toEqual([true,false])
})

test('Notification settings share device registration without changing the separate Coach choice',async({page})=>{
 await start(page)
 await page.locator('.app-navigation [data-screen="teams"]').click()
 await expect(page.getByRole('button',{name:'Turn off chat notifications',exact:true})).toBeEnabled()
 const before=await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.appWrites)
 const dialog=await settings(page),section=dialog.getByRole('region',{name:'Notifications',exact:true})
 await section.getByRole('button',{name:'Turn off chat notifications',exact:true}).click()
 await expect(section.getByRole('button',{name:'Enable chat notifications',exact:true})).toBeEnabled()
 await expect(section.getByRole('button',{name:'Turn on Coach alerts',exact:true})).toBeDisabled()
 await dialog.getByRole('button',{name:'Close account settings',exact:true}).click()
 await expect(page.getByRole('button',{name:'Turn on Coach alerts',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Enable chat notifications',exact:true}).click()
 await expect(page.getByRole('button',{name:'Turn on Coach alerts',exact:true})).toBeEnabled()
 expect(await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.appWrites)).toEqual([...before,false,true])
 expect(await page.evaluate(()=>(window as unknown as Preview).nativeCoachAlertFixture.writes)).toEqual([])
})

test('Notification settings are omitted when native alerts are unsupported',async({page})=>{
 await start(page,320,false)
 await page.getByRole('button',{name:'Account settings',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Account settings',exact:true})
 await expect(dialog.getByRole('button',{name:'Your tools',exact:true})).toBeVisible()
 await expect(dialog.getByRole('button',{name:'Notifications',exact:true})).toHaveCount(0)
})

test('Notification settings can close during a Coach save and the remaining view receives its confirmation',async({page})=>{
 await start(page,390,false)
 await page.evaluate(()=>{const f=(window as unknown as Preview).coachAlertFixture;f.mount();f.openExtra()})
 const first=page.locator('[data-coach-alert-preview]'),extra=page.locator('[data-coach-alert-secondary]')
 await expect(extra.getByRole('button',{name:'Turn on Coach alerts',exact:true})).toBeEnabled()
 await page.evaluate(()=>(window as unknown as Preview).coachAlertFixture.hold=true)
 await extra.getByRole('button',{name:'Turn on Coach alerts',exact:true}).click()
 await expect(first).toContainText('Saving your choice…')
 await page.evaluate(()=>{const f=(window as unknown as Preview).coachAlertFixture;f.closeExtra();f.release()})
 await expect(first.getByRole('button',{name:'Turn off Coach alerts',exact:true})).toBeEnabled()
 expect(await page.evaluate(()=>(window as unknown as Preview).coachAlertFixture.writes)).toEqual([true])
})

test('Notification settings disposal prevents detached controls from changing alerts',async({page})=>{
 await start(page,390,false)
 await page.evaluate(()=>{const f=(window as unknown as Preview).coachAlertFixture;f.mount();f.openExtra()})
 const extra=page.locator('[data-coach-alert-secondary]')
 await expect(extra.getByRole('button',{name:'Turn on Coach alerts',exact:true})).toBeEnabled()
 await extra.evaluate(el=>{
  const buttons=Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
  ;(window as unknown as Preview).coachAlertFixture.closeExtra()
  buttons.forEach(button=>button.click())
 })
 expect(await page.evaluate(()=>(window as unknown as Preview).coachAlertFixture.writes)).toEqual([])
 expect(await page.evaluate(()=>(window as unknown as Preview).coachAlertFixture.registered)).toBe(true)
})

test('Notification settings serialize rapid device-alert choices across both views',async({page})=>{
 await start(page,390,false)
 await page.evaluate(()=>{const f=(window as unknown as Preview).coachAlertFixture;f.registered=false;f.mount();f.openExtra()})
 await expect(page.locator('[data-coach-alert-secondary]').getByRole('button',{name:'Enable chat notifications',exact:true})).toBeEnabled()
 await page.evaluate(()=>{
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-coach-alert-preview]>button,[data-coach-alert-secondary]>button'))
  buttons.forEach(button=>button.click())
 })
 await expect(page.locator('[data-coach-alert-preview]').getByRole('button',{name:'Turn off chat notifications',exact:true})).toBeEnabled()
 await expect(page.locator('[data-coach-alert-secondary]').getByRole('button',{name:'Turn off chat notifications',exact:true})).toBeEnabled()
 expect(await page.evaluate(()=>(window as unknown as Preview).coachAlertFixture.registered)).toBe(true)
 expect(await page.evaluate(()=>(window as unknown as Preview).coachAlertFixture.writes)).toEqual([])
})
