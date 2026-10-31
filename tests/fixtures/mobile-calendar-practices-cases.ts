import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283',event='44444444-4444-4444-8444-444444444444'
type Preview=Window&{calendarTeamFixture:{enabled:boolean;fail:boolean;deny:boolean;defer:boolean;release:()=>void;loseWrite:boolean;requests:{method:string;query:string;body:Record<string,unknown>|null}[]};switchNavigationOwner:()=>void}
async function calendar(page:Page,width=390){
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1');await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.enabled=true)
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="calendar"]').click();const d=page.getByRole('dialog',{name:'Your calendar',exact:true});await expect(d.locator('.cal-event.team')).toHaveCount(2);return d
}
async function practice(page:Page,d:ReturnType<Page['getByRole']>){await d.locator('[data-cal-event="team-practice:'+event+'"]').click();await expect(d).toContainText('18:00 – 20:15');await d.getByRole('button',{name:'Open practice & RSVP',exact:true}).click();const child=page.getByRole('dialog',{name:'Team practices',exact:true});await expect(child).toContainText('Your RSVP · Jordan Lee');return child}
for(const width of [320,390])test('Calendar team practices: readable dates, exact RSVP and retained filters at '+width+'px',async({page},info)=>{
 const d=await calendar(page,width);await expect(d.locator('.cal-event.team img')).toHaveCount(0);await expect(d.locator('.cal-event.team').first()).toContainText('Team practice · Baseline Aces');await expect(d.locator('.cal-event.team').first()).toContainText('Waitlist');await expect(d.locator('.cal-event.team').last()).toContainText('Cancelled')
 await d.getByRole('button',{name:'Month',exact:true}).click();await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('team');await expect(d.locator('.cal-event')).toHaveCount(2)
 expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await d.locator('.cal-body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await d.locator('.cal-event.team').first().scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('calendar-team-'+width+'.png')});const child=await practice(page,d)
 expect(await child.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect(child.getByRole('button',{name:'Back to practices',exact:true})).toHaveCount(0)
 const request=new URLSearchParams(await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.requests.find(r=>r.query.includes('eventId'))!.query));expect(Object.fromEntries(request)).toEqual({team:'Baseline Aces',league:'City League',flight:'4.0',eventId:event})
 await child.locator('[data-response="out"]').click();expect(await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.requests.filter(r=>r.method==='PATCH').length)).toBe(0)
 await expect(child).toContainText('Review your RSVP');await child.getByRole('button',{name:'Save RSVP',exact:true}).click();await expect(child).toContainText('Your RSVP is saved. Out.')
 await child.getByRole('button',{name:'Back to calendar',exact:true}).click();await expect(child).toHaveCount(0);await expect(d.getByRole('combobox',{name:'Show',exact:true})).toHaveValue('team');await expect(d.getByRole('button',{name:'Month',exact:true})).toHaveAttribute('aria-pressed','true');await expect(d.locator('[data-cal-event="team-practice:'+event+'"]')).toContainText('Out');await expect(d.locator('[data-cal-event="team-practice:'+event+'"]')).toBeFocused()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('Calendar team practices: interrupted RSVP uses the existing exact receipt check without a duplicate write',async({page})=>{
 const d=await calendar(page),child=await practice(page,d);await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.loseWrite=true)
 await child.locator('[data-response="maybe"]').click();await child.getByRole('button',{name:'Save RSVP',exact:true}).click();await expect(child).toContainText('RSVP not confirmed')
 await child.getByRole('button',{name:'Check saved reply',exact:true}).click();await expect(child).toContainText('Your RSVP is saved. Maybe.');expect(await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.requests.filter(r=>r.method==='PATCH').length)).toBe(1)
})
test('Calendar team practices: failures remain unavailable while personal dates stay usable',async({page})=>{
 const d=await calendar(page);await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.fail=true);await d.getByRole('button',{name:'Refresh',exact:true}).click();await expect(d).toContainText('Team practice dates couldn’t load');await expect(d.locator('.cal-event.personal')).toHaveCount(1)
 await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('team');await expect(d).toContainText('Team practices are unavailable.');await expect(d).not.toContainText('No dates in this view.')
 await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.fail=false);await d.getByRole('button',{name:'Refresh',exact:true}).click();await expect(d.locator('.cal-event.team')).toHaveCount(2)
})
test('Calendar team practices: revoked access never opens another practice and return removes stale dates',async({page})=>{
 const d=await calendar(page);await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.deny=true)
 await d.locator('[data-cal-event="team-practice:'+event+'"]').click();await d.getByRole('button',{name:'Open practice & RSVP',exact:true}).click();const child=page.getByRole('dialog',{name:'Team practices',exact:true});await expect(child).toContainText('Practices could not be loaded');await expect(child.locator('[data-response]')).toHaveCount(0)
 await child.getByRole('button',{name:'Back to calendar',exact:true}).click();await expect(d.locator('.cal-event.team')).toHaveCount(0)
})
test('Calendar team practices: calendar Back protects the nested RSVP draft and account changes dispose both views',async({page})=>{
 const d=await calendar(page),child=await practice(page,d);await child.locator('[data-note]').fill('A private reply draft')
 await d.evaluate(el=>el.dispatchEvent(new Event('cancel',{cancelable:true})));await expect(child).toContainText('Leave this RSVP?');await expect(d).toBeVisible();await child.getByRole('button',{name:'Keep reply',exact:true}).click();await expect(child.locator('[data-note]')).toHaveValue('A private reply draft')
 await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(child).toHaveCount(0);await expect(d).toHaveCount(0);expect(await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.requests.filter(r=>r.method==='PATCH').length)).toBe(0)
})
test('Calendar team practices: an old source response is ignored after the account changes',async({page})=>{
 const d=await calendar(page);await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.defer=true);await d.getByRole('button',{name:'Refresh',exact:true}).click();await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(d).toHaveCount(0);await page.evaluate(()=>(window as unknown as Preview).calendarTeamFixture.release());await expect(page.getByRole('dialog')).toHaveCount(0)
})
