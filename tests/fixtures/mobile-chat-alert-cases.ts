import {test,expect} from '@playwright/test'
const origin='http://127.0.0.1:4283'
type Preview=Window&{chatUnreadFixture:{total:number;fail:boolean;emit:()=>void}}
for(const width of [320,390])test('Chats badges follow live unread counts and keep settings distinct at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 const chats=page.locator('.app-navigation [data-screen="teams"]'),badge=chats.locator('[data-chat-badge]')
 await expect(chats).toHaveAttribute('aria-label','Chats, 7 unread messages');await expect(badge).toHaveText('7')
 const account=page.locator('.native-account-entry');await expect(account).toHaveAttribute('aria-label','Account settings')
 expect(await account.locator('svg').innerHTML()).not.toBe(await page.locator('[data-lab-profile] svg').innerHTML())
 await chats.click();await expect(page.locator('[data-open-team-chat]')).toHaveAttribute('aria-label','Baseline Aces · City League · 4.0, 7 unread messages');await expect(page.locator('[data-team-unread]')).toHaveText('7')
 await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.total=100;f.emit()})
 await expect(badge).toHaveText('99+');await expect(page.locator('[data-team-unread]')).toHaveText('99+')
 await expect(chats).toHaveAttribute('aria-label','Chats, 99+ unread messages')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('chat-alerts-'+width+'.png')})
 await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.total=0;f.emit()})
 await expect(badge).toBeHidden();await expect(page.locator('[data-team-unread]')).toBeHidden()
 await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.fail=true;f.emit()})
 await expect(chats).toHaveAttribute('aria-label','Chats');await expect(badge).toBeHidden()
})
