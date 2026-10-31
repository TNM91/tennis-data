import {test, expect, type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin = 'http://127.0.0.1:4285'
let javascript = '', stylesheet = '', shell = ''
test.describe.configure({retries: 0, timeout: 30000})
test.beforeAll(async () => {
 const bundle = await build({entryPoints: ['tests/fixtures/mobile-navigation.ts'], bundle: true, platform: 'browser', format: 'esm', outfile: 'fixture.js', write: false, jsx: 'automatic', loader: {'.module.css': 'local-css'}, alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},plugins: [{name: 'synthetic-coach-account', setup(b) {b.onResolve({filter: /^@supabase\/supabase-js$/}, () => ({path: path.resolve('tests/fixtures/mobile-navigation-client.ts')}))}}]})
 javascript = bundle.outputFiles.find(f => f.path.endsWith('.js'))!.text
 stylesheet = (await Promise.all(['style.css', 'website-ui.css', 'app.css', 'website-parity.css', 'app-atmosphere.css'].map(f => f==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text):readFile('mobile/bundled/' + f, 'utf8')))).join('\n')
 shell = await readFile('mobile/bundled/index.html', 'utf8')
})
test.beforeEach(async ({page}) => {
 await page.route('**/*', async route => {
  const url = new URL(route.request().url()); if (url.origin !== origin) return route.abort()
  if (url.pathname === '/app.js') return route.fulfill({contentType: 'text/javascript', body: javascript})
  if (url.pathname.endsWith('.css')) return route.fulfill({contentType: 'text/css', body: url.pathname === '/style.css' ? stylesheet + (url.searchParams.has('large') ? '\n:root{font-size:22px!important}' : '') : ''})
  if (url.pathname.startsWith('/brand/') || url.pathname.startsWith('/tiq/tokens/') || url.pathname === '/logo.png') return route.fulfill({contentType: 'image/png', body: await readFile('mobile/bundled' + url.pathname)})
  return route.fulfill({contentType: 'text/html', body: url.searchParams.has('large') ? shell.replace('./style.css', './style.css?large=1') : shell})
 })
})
async function open(page: Page, large = false) {
 await page.goto(origin + (large ? '/?large=1' : '')); await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 await page.getByRole('button', {name: 'More', exact: true}).click(); await page.locator('[data-app-destination="coach"]').click()
 await page.locator('[data-app-destination="coach-workspace"]').click()
 const d = page.getByRole('dialog', {name: 'Coach workspace', exact: true}); await expect(d).toContainText('Alex Rivera'); return d
}
async function fits(page: Page) {
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
 expect(await page.getByRole('dialog', {name: 'Coach workspace', exact: true}).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
}
for (const width of [320, 390]) test('native Coach roster, assignments and player feedback at ' + width + 'px', async ({page}, info) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.setViewportSize({width, height: 844}); const d = await open(page)
 await fits(page); await d.getByRole('button', {name: /Alex Rivera/}).click(); await expect(d.getByRole('heading', {name: 'Alex Rivera', exact: true})).toBeFocused()
 await d.getByRole('button', {name: /Deep return under pressure/}).click(); await expect(d).toContainText('Four of five returns stayed deep.')
 await d.getByRole('button', {name: 'Review player check-in', exact: true}).click(); await d.getByLabel('Your feedback', {exact: true}).fill('Good depth. Split step a little earlier.'); await d.getByLabel('Next tennis focus', {exact: true}).fill('Return height')
 await d.getByRole('button', {name: 'Review feedback', exact: true}).click(); await fits(page); await d.getByRole('button', {name: 'Save feedback', exact: true}).click(); await expect(d).toContainText('Saved to your Coach workspace.')
 await d.getByRole('button', {name: /Deep return under pressure/}).click(); await expect(d).toContainText('Good depth. Split step a little earlier.'); await d.getByRole('button', {name: 'Back to student', exact: true}).click()
 await d.getByRole('button', {name: 'Assign practice', exact: true}).click(); await d.getByLabel('Assignment title', {exact: true}).fill('Serve plus one'); await d.getByLabel('What to practise', {exact: true}).fill('Hit five wide serves and a deep forehand.'); await d.getByLabel('Due date (optional)', {exact: true}).fill('2026-11-07'); await fits(page)
 await d.getByRole('button', {name: 'Review assignment', exact: true}).click(); await expect(d).toContainText('connected student'); await d.getByRole('button', {name: 'Assign practice', exact: true}).click(); await expect(d.getByRole('button', {name: /Serve plus one/})).toBeVisible()
 await d.getByRole('button', {name: 'Close Coach workspace', exact: true}).click(); await expect(page.locator('[data-app-destination="coach-workspace"]')).toBeFocused()
 const enlarged = await open(page, true); await fits(page); await enlarged.getByRole('button', {name: 'Add a student', exact: true}).click(); await enlarged.getByLabel('Player name', {exact: true}).fill('Taylor Chen'); await enlarged.getByLabel('Tennis level', {exact: true}).fill('3.5'); await enlarged.getByLabel('Private coaching notes', {exact: true}).fill('Build a reliable second serve.'); await fits(page)
 await enlarged.getByRole('button', {name: 'Review student record', exact: true}).click(); await expect(enlarged).toContainText('No invitation is sent'); await enlarged.getByRole('button', {name: 'Create student record', exact: true}).click(); await expect(enlarged.getByRole('heading', {name: 'Taylor Chen', exact: true})).toBeVisible(); await expect(enlarged).toContainText('Roster only'); await fits(page)
 await page.screenshot({path: info.outputPath('coach-student-large-text.png')}); expect(errors).toEqual([])
})
test('checks a lost confirmation without duplicate mutation, preserving draft on token refresh', async ({page}) => {
 await page.setViewportSize({width: 320, height: 844}); const d = await open(page)
 await d.getByRole('button', {name: 'Add a student', exact: true}).click(); await d.getByLabel('Player name', {exact: true}).fill('Jordan Rally')
 await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-preview-refresh]')!.click()); await expect(d.getByLabel('Player name', {exact: true})).toHaveValue('Jordan Rally')
 await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-coach-lose]')!.click())
 await d.getByRole('button', {name: 'Review student record', exact: true}).click(); await d.getByRole('button', {name: 'Create student record', exact: true}).click()
 await expect(d.getByRole('button', {name: 'Retry same update', exact: true})).toBeDisabled(); await d.getByRole('button', {name: 'Check saved work', exact: true}).click(); await expect(d.getByRole('heading', {name: 'Jordan Rally', exact: true})).toBeVisible()
 await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 1')
})
test('rejects newer player proof and leaves editing only after confirmation', async ({page}) => {
 const d = await open(page); await d.getByRole('button', {name: /Alex Rivera/}).click(); await d.getByRole('button', {name: /Deep return under pressure/}).click(); await d.getByRole('button', {name: 'Review player check-in', exact: true}).click(); await d.getByLabel('Your feedback', {exact: true}).fill('Keep the first version')
 await d.getByRole('button', {name: 'Close Coach workspace', exact: true}).click(); await expect(d).toContainText('Your unsaved edits will be discarded.'); await d.getByRole('button', {name: 'Keep editing', exact: true}).click(); await expect(d.getByLabel('Your feedback', {exact: true})).toHaveValue('Keep the first version')
 await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-coach-race]')!.click()); await d.getByRole('button', {name: 'Review feedback', exact: true}).click(); await d.getByRole('button', {name: 'Save feedback', exact: true}).click(); await expect(d).toContainText('This record changed.')
 await d.getByRole('button', {name: 'Check saved work', exact: true}).click(); await expect(d.getByRole('button', {name: 'Retry same update', exact: true})).toBeDisabled(); await d.getByRole('button', {name: 'Back', exact: true}).click(); await d.getByRole('button', {name: 'Discard edits', exact: true}).click(); await d.getByRole('button', {name: /Deep return under pressure/}).click(); await expect(d).toContainText('Newer player proof'); await expect(d).not.toContainText('Keep the first version')
})
test('closes private Coach state on account change and rejects missing Coach access', async ({page}) => {
 let d = await open(page); await d.getByRole('button', {name: 'Add a student', exact: true}).click(); await d.getByLabel('Player name', {exact: true}).fill('Private draft')
 await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click()); await expect(d).toHaveCount(0); await expect(page.locator('.lab-scoreboard')).toBeVisible(); await expect(page.locator('body')).not.toContainText('Private draft')
 await page.goto(origin); await expect(page.locator('.lab-scoreboard')).toBeVisible(); await page.locator('[data-coach-deny]').waitFor({state: 'attached'}); await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-coach-deny]')!.click()); await page.getByRole('button', {name: 'More', exact: true}).click(); await page.locator('[data-app-destination="coach"]').click(); await page.locator('[data-app-destination="coach-workspace"]').click()
 d = page.getByRole('dialog', {name: 'Coach workspace', exact: true}); await expect(d).toContainText('Coach access is required'); await expect(d.getByRole('button', {name: 'Add a student', exact: true})).toHaveCount(0)
})

async function switchApp(page: Page) {
 await page.evaluate(() => {Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'}); document.dispatchEvent(new Event('visibilitychange'))})
 await page.evaluate(() => {Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'}); document.dispatchEvent(new Event('visibilitychange'))})
}
for (const width of [320, 390]) test('keeps background drafts and creates and revokes a student invitation at ' + width + 'px', async ({page}) => {
 await page.setViewportSize({width, height: 844}); const d = await open(page, true)
 await d.getByRole('button', {name: 'Add a student', exact: true}).click(); await d.getByLabel('Player name', {exact: true}).fill('Taylor Chen'); await d.getByLabel('Private coaching notes', {exact: true}).fill('Private draft kept in memory')
 await switchApp(page); await expect(d.getByLabel('Player name', {exact: true})).toHaveValue('Taylor Chen'); await expect(d.getByLabel('Private coaching notes', {exact: true})).toHaveValue('Private draft kept in memory')
 await d.getByRole('button', {name: 'Review student record', exact: true}).click(); await switchApp(page); await expect(d).toContainText('Private draft kept in memory'); await d.getByRole('button', {name: 'Create student record', exact: true}).click()
 await d.getByRole('button', {name: 'Student invitations', exact: true}).click(); const invite = page.getByRole('dialog', {name: 'Coach invitations', exact: true})
 await invite.getByRole('button', {name: 'Create an invitation', exact: true}).click(); await invite.getByLabel('Player’s account email', {exact: true}).fill('a-long-tennis-player-name@example.test'); await invite.getByLabel('Message (optional)', {exact: true}).fill('Bring back your second-serve practice check-in.'); await switchApp(page)
 await invite.getByRole('button', {name: 'Close Coach invitations', exact: true}).click(); await expect(invite).toContainText('Your unsaved invitation details will be discarded.'); await invite.getByRole('button', {name: 'Keep editing', exact: true}).click()
 await expect(invite.getByLabel('Player’s account email', {exact: true})).toHaveValue('a-long-tennis-player-name@example.test')
 await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-preview-refresh]')!.click()); await expect(invite.getByLabel('Message (optional)', {exact: true})).toHaveValue('Bring back your second-serve practice check-in.')
 await invite.getByRole('button', {name: 'Review invitation', exact: true}).click(); await expect(invite).toContainText('seven days'); await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-coach-lose]')!.click()); await invite.getByRole('button', {name: 'Create invitation', exact: true}).click()
 await expect(invite.getByRole('button', {name: 'Retry same change', exact: true})).toBeDisabled(); await switchApp(page); await invite.getByRole('button', {name: 'Check invitations', exact: true}).click()
 await expect(invite.getByRole('button', {name: 'Share link', exact: true})).toBeVisible(); await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 2')
 expect(await invite.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await fits(page)
 await invite.getByRole('button', {name: 'Revoke link', exact: true}).click(); await invite.getByRole('button', {name: 'Revoke invitation', exact: true}).click(); await expect(invite).toContainText('Invitation revoked.'); await expect(invite.getByRole('button', {name: 'Share link', exact: true})).toHaveCount(0)
 await invite.getByRole('button', {name: 'Close Coach invitations', exact: true}).click(); await expect(d.getByRole('button', {name: 'Student invitations', exact: true})).toBeFocused()
})
test('discards invitation drafts only by choice and removes both dialogs on account switch', async ({page}) => {
 const d = await open(page); await d.getByRole('button', {name: /Alex Rivera/}).click(); await d.getByRole('button', {name: 'Student invitations', exact: true}).click()
 const invite = page.getByRole('dialog', {name: 'Coach invitations', exact: true}); await expect(invite).toContainText('This student is connected.'); await expect(invite.getByRole('button', {name: 'Create an invitation', exact: true})).toHaveCount(0)
 await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click()); await expect(invite).toHaveCount(0); await expect(d).toHaveCount(0)
})

for(const width of [320,390])test('edits students and completed practice while retaining proof at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});const d=await open(page,true)
 await d.getByRole('button',{name:/Alex Rivera/}).click();await d.getByRole('button',{name:'Edit student',exact:true}).click()
 await d.getByLabel('Player name',{exact:true}).fill('Alex Court');await d.getByLabel('Student status',{exact:true}).selectOption('paused')
 await switchApp(page);await expect(d.getByLabel('Player name',{exact:true})).toHaveValue('Alex Court');await fits(page)
 await d.getByRole('button',{name:'Review student changes',exact:true}).click();await d.getByRole('button',{name:'Save student changes',exact:true}).click()
 await expect(d.getByRole('heading',{name:'Alex Court',exact:true})).toBeVisible();await expect(d).toContainText('Connected to a player account');await expect(d.getByRole('button',{name:'Assign practice',exact:true})).toBeDisabled()
 await d.getByRole('button',{name:'Edit student',exact:true}).click();await d.getByLabel('Student status',{exact:true}).selectOption('active');await d.getByRole('button',{name:'Review student changes',exact:true}).click();await d.getByRole('button',{name:'Save student changes',exact:true}).click()
 await d.getByRole('button',{name:/Deep return under pressure/}).click();await d.getByRole('button',{name:'Edit assignment',exact:true}).click()
 await d.getByLabel('Assignment title',{exact:true}).fill('Deep return, clear the net');await d.getByLabel('What to practise',{exact:true}).fill('Aim three feet above the net.')
 await d.getByRole('button',{name:'Review assignment changes',exact:true}).click();await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-coach-lose]')!.click());await d.getByRole('button',{name:'Save assignment changes',exact:true}).click()
 await expect(d.getByRole('button',{name:'Retry same update',exact:true})).toBeDisabled();await d.getByRole('button',{name:'Check saved work',exact:true}).click();await d.getByRole('button',{name:/Deep return, clear the net/}).click()
 await expect(d).toContainText('Four of five returns stayed deep.');await expect(d).toContainText('Aim three feet above the net.');await expect(d).toContainText('Completed');await fits(page)
 await page.screenshot({path:info.outputPath('coach-edited-proof.png')});await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 3')
})

test('rejects a concurrent assignment edit and publishes a saved draft by explicit review',async({page})=>{
 const d=await open(page);await d.getByRole('button',{name:/Alex Rivera/}).click();await d.getByRole('button',{name:/Deep return under pressure/}).click();await d.getByRole('button',{name:'Edit assignment',exact:true}).click();await d.getByLabel('Assignment title',{exact:true}).fill('Do not overwrite newer proof')
 await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-coach-race]')!.click());await d.getByRole('button',{name:'Review assignment changes',exact:true}).click();await d.getByRole('button',{name:'Save assignment changes',exact:true}).click();await d.getByRole('button',{name:'Check saved work',exact:true}).click();await expect(d.getByRole('button',{name:'Retry same update',exact:true})).toBeDisabled()
 await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('button',{name:'Discard edits',exact:true}).click();await d.getByRole('button',{name:'Assign practice',exact:true}).click();await d.getByLabel('Assignment title',{exact:true}).fill('Draft serve reps');await d.getByLabel('What to practise',{exact:true}).fill('Five wide serves.');await d.getByRole('button',{name:'Review as draft',exact:true}).click();await d.getByRole('button',{name:'Save draft',exact:true}).click()
 await d.getByRole('button',{name:/Draft serve reps/}).click();await d.getByRole('button',{name:'Edit assignment',exact:true}).click();await d.getByRole('button',{name:'Review and assign practice',exact:true}).click();await d.getByRole('button',{name:'Save assignment changes',exact:true}).click();await d.getByRole('button',{name:/Draft serve reps/}).click();await expect(d).toContainText('Assigned')
})

for(const width of [320,390])test('accepts a coach link with review, lost-response recovery and account cleanup at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1');await expect(page.locator('.lab-scoreboard')).toBeVisible();await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();const opener=page.locator('[data-app-destination="coach-connection"]');await opener.click()
 const d=page.getByRole('dialog',{name:'Accept coach invitation',exact:true});await d.getByLabel('Invitation link',{exact:true}).fill('https://www.tenaceiq.com/coach/invite/wrong-email');await d.getByRole('button',{name:'Review invitation',exact:true}).click();await expect(d).toContainText('Sign in with the email address your coach invited.')
 await d.getByLabel('Invitation link',{exact:true}).fill('https://www.tenaceiq.com/coach/invite/invite-token');await switchApp(page);await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-refresh]')!.click());await expect(d.getByLabel('Invitation link',{exact:true})).toHaveValue('https://www.tenaceiq.com/coach/invite/invite-token')
 await d.getByRole('button',{name:'Review invitation',exact:true}).click();await expect(d).toContainText('Alex Rivera');await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 0');expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 await page.screenshot({path:info.outputPath('coach-invitation-review.png')});await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-coach-lose]')!.click());await d.getByRole('button',{name:'Connect my account',exact:true}).click();await expect(d.getByRole('button',{name:'Connect my account',exact:true})).toBeDisabled();await d.getByRole('button',{name:'Check connection',exact:true}).click();await expect(d.getByRole('heading',{name:'You’re connected',exact:true})).toBeFocused();await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 1')
 await d.getByRole('button',{name:'Close',exact:true}).click();await expect(opener).toBeFocused();await opener.click();await d.getByLabel('Invitation link',{exact:true}).fill('private-token');await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click());await expect(d).toHaveCount(0);await expect(page.locator('body')).not.toContainText('private-token')
})
