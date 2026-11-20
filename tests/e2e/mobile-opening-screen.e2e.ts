import {test, expect, type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin = 'http://127.0.0.1:4285', owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
let javascript = '', stylesheet = '', shell = ''
test.describe.configure({retries: 0, timeout: 30000})
test.beforeAll(async () => {
  const bundle = await build({entryPoints: ['tests/fixtures/mobile-navigation.ts'], bundle: true, platform: 'browser', format: 'esm', outfile: 'fixture.js', write: false,
    jsx: 'automatic', define: {TIQ_FIRST_PARTY_BUILD: 'true'}, loader: {'.module.css': 'local-css'},
    alias: {'next/image': path.resolve('mobile/src/native-website-image.tsx'), 'next/link': path.resolve('mobile/src/native-website-link.tsx')},
    plugins: [{name: 'synthetic-opening-screen', setup(builder) {
      builder.onResolve({filter: /^\.\/native-push$/}, args => args.importer.replace(/\\/g, '/').endsWith('/mobile/src/main.ts') ? {path: path.resolve('tests/fixtures/mobile-native-coach-alerts.ts')} : undefined)
      builder.onResolve({filter: /^@capacitor\/app$/}, () => ({path: path.resolve('tests/fixtures/mobile-navigation-app.ts')}))
      builder.onResolve({filter: /^@supabase\/supabase-js$/}, () => ({path: path.resolve('tests/fixtures/mobile-navigation-client.ts')}))
    }}]})
  javascript = bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text
  stylesheet = (await Promise.all(['style.css', 'website-ui.css', 'app.css', 'website-parity.css', 'app-atmosphere.css', 'premium-surfaces.css']
    .map(file => file === 'app.css' ? Promise.resolve(bundle.outputFiles.find(output => output.path.endsWith('.css'))!.text) : readFile('mobile/bundled/' + file, 'utf8')))).join('\n')
  shell = await readFile('mobile/bundled/index.html', 'utf8')
})
test.beforeEach(async ({page}) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/app.js') return route.fulfill({contentType: 'text/javascript', body: javascript})
    if (url.pathname.endsWith('.css')) return route.fulfill({contentType: 'text/css', body: url.pathname === '/style.css' ? stylesheet + (url.searchParams.has('large') ? '\n:root{font-size:22px!important}' : '') : ''})
    if (url.pathname.startsWith('/brand/') || url.pathname === '/logo.png') return route.fulfill({contentType: 'image/png', body: await readFile('mobile/bundled' + url.pathname)})
    return route.fulfill({contentType: 'text/html', body: url.searchParams.has('large') ? shell.replace('./style.css', './style.css?large=1') : shell})
  })
})
async function seed(page: Page, choice: string, last = 'lab') {
  await page.addInitScript(({owner, choice, last}) => {
    // Seed once so reloads test the app's own persisted writes.
    if (sessionStorage.getItem('opening-seeded')) return
    localStorage.setItem('opening-screen:v1:' + owner, choice)
    localStorage.setItem('opening-tab:v1:' + owner, last)
    sessionStorage.setItem('opening-seeded', '1')
  }, {owner, choice, last})
}
async function selected(page: Page, name: string) {
  const nav = page.locator('.app-navigation')
  const tab = ({'My Lab': 'lab', Chats: 'teams', Explore: 'explore', Compete: 'compete', More: 'more'} as Record<string, string>)[name]
  await expect(nav.locator('[data-screen="' + tab + '"]')).toHaveAttribute('aria-current', 'page')
  await expect(nav.locator('button')).toHaveCount(5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function settings(page: Page) {
  await page.getByRole('button', {name: 'Account settings', exact: true}).click()
  const dialog = page.getByRole('dialog', {name: 'Account settings', exact: true})
  await dialog.getByRole('button', {name: 'Opening screen', exact: true}).click()
  await expect(dialog.getByLabel('Open the app to')).toBeEnabled()
  return dialog
}
for (const [choice, tab] of [['lab','My Lab'], ['teams','Chats'], ['explore','Explore'], ['compete','Compete'], ['last','More']]) {
  test('starts fresh on ' + tab + ' without changing the five bottom tabs', async ({page}) => {
    await seed(page, choice, 'more'); await page.goto(origin + '/?unlinked=1')
    await selected(page, tab)
    if (choice !== 'lab') await expect(page.locator('.lab-starter-tiq')).toHaveCount(0)
  })
}
test('saves a device choice without navigating away and applies it on the next cold start', async ({page}, info) => {
  await page.setViewportSize({width: 320, height: 844})
  await page.goto(origin + '/?unlinked=1&large=1')
  await selected(page, 'My Lab')
  const dialog = await settings(page), select = dialog.getByLabel('Open the app to'), save = dialog.getByRole('button', {name: 'Save opening screen'})
  await expect(select).toHaveValue('lab'); await expect(save).toBeDisabled()
  await expect(select).toHaveCSS('background-color', 'rgb(9, 26, 51)')
  await expect(select).toHaveCSS('background-image', /linear-gradient/)
  await select.selectOption('teams'); await save.click()
  await expect(dialog.locator('.opening-screen-status')).toHaveText('Opening screen saved on this device.')
  await expect(dialog.locator('.opening-screen-status')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({path: info.outputPath('opening-screen-settings.png'), scale: 'css'})
  await dialog.getByRole('button', {name: 'Close account settings'}).click()
  await selected(page, 'My Lab'); await page.reload(); await selected(page, 'Chats')
})
test('remembers the actual last tab while token refresh and returning to the app preserve an unsent chat', async ({page}) => {
  await seed(page, 'last', 'teams'); await page.goto(origin + '/?unlinked=1')
  await selected(page, 'Chats')
  await page.getByRole('button', {name: /Baseline Aces/}).first().click()
  const message = page.getByPlaceholder('Message…'); await message.fill('Friday at six?')
  await page.evaluate(() => {
    (window as unknown as {refreshNavigationSession: () => void}).refreshNavigationSession()
    window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(message).toHaveValue('Friday at six?')
  await message.fill(''); await page.getByRole('button', {name: 'All team chats', exact: true}).click()
  await page.getByRole('button', {name: 'Compete', exact: true}).click()
  await selected(page, 'Compete')
  await expect.poll(() => page.evaluate(owner => localStorage.getItem('opening-tab:v1:' + owner), owner)).toBe('compete')
  await page.reload(); await selected(page, 'Compete')
})
test('switches accounts without showing the prior account’s settings or inheriting its opening choice', async ({page}) => {
  await seed(page, 'teams')
  await page.addInitScript(other => localStorage.setItem('opening-screen:v1:' + other, 'explore'), other)
  await page.goto(origin + '/?unlinked=1'); await selected(page, 'Chats')
  const dialog = await settings(page)
  await page.evaluate(() => (window as unknown as {switchNavigationOwner: () => void}).switchNavigationOwner())
  await expect(dialog).toHaveCount(0); await selected(page, 'Explore')
  expect(await page.evaluate(owner => localStorage.getItem('opening-screen:v1:' + owner), owner)).toBe('teams')
  await page.evaluate(() => (window as unknown as {switchNavigationOwner: (restore: boolean) => void}).switchNavigationOwner(true))
  await selected(page, 'Chats')
})
test('keeps a failed preference save retryable and falls back to My Lab when storage cannot be read', async ({page}) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    let failWrite = true
    Storage.prototype.getItem = function(key) {if (key.startsWith('opening-screen:')) throw Error('Locked'); return get.call(this, key)}
    Storage.prototype.setItem = function(key, value) {if (key.startsWith('opening-screen:') && failWrite) {failWrite = false; throw Error('Locked')} return set.call(this, key, value)}
    Object.assign(window, {unlockOpening: () => {Storage.prototype.getItem = get}})
  })
  await page.goto(origin + '/?unlinked=1'); await selected(page, 'My Lab')
  const dialog = await settings(page), select = dialog.getByLabel('Open the app to'), save = dialog.getByRole('button', {name: 'Save opening screen'})
  await select.selectOption('teams'); await save.click()
  await expect(dialog.locator('.opening-screen-status')).toContainText('Couldn’t save')
  await expect(select).toHaveValue('teams'); await expect(save).toBeEnabled()
  await page.evaluate(() => (window as unknown as {unlockOpening: () => void}).unlockOpening())
  await save.click(); await expect(dialog.locator('.opening-screen-status')).toContainText('Opening screen saved')
})
test('a cold shared team link opens its destination ahead of the chosen Explore tab', async ({page}) => {
  await seed(page, 'explore')
  await page.goto(origin + '/?unlinked=1&link=' + encodeURIComponent('https://www.tenaceiq.com/team-room?team=Baseline%20Aces&league=City%20League&flight=4.0'))
  await expect(page.locator('.team-conversation')).toBeVisible(); await selected(page, 'Chats')
})
test('a cold coaching notification opens its check-in from a preferred Chats start', async ({page}) => {
  await seed(page, 'teams'); await page.goto(origin + '/?hit-alerts=1&coach-activity=checkin&coldCoachActivity=1&duplicateAuth=1')
  await expect(page.getByRole('dialog', {name: 'Coach workspace', exact: true})).toContainText('Deep return under pressure')
})
test('an incoming coaching update keeps an in-progress self assessment intact', async ({page}) => {
  await page.goto(origin + '/?unlinked=1&hit-alerts=1&coach-activity=checkin')
  const starter = page.getByRole('region', {name: 'Your TiQ'})
  await starter.getByRole('button', {name: 'Find my level'}).click()
  await starter.getByLabel('How reliable is your serve?').selectOption('2')
  await page.evaluate(() => (window as unknown as {hitAlertsFixture: {tap: (href: string) => void}}).hitAlertsFixture.tap('/mylab?coachActivityNotice=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
  await expect(starter.getByLabel('How reliable is your serve?')).toHaveValue('2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', {name: 'Open coaching update', exact: true}).click()
  await expect(page.getByLabel('Coaching update', {exact: true})).toContainText('Close your current form')
})
for (const width of [320, 390]) test('uses one quiet card palette and clear action states across tabs at ' + width + 'px', async ({page}, info) => {
  await page.setViewportSize({width, height: 844})
  await page.addInitScript(owner => localStorage.setItem('starter-tiq:v1:' + owner, JSON.stringify([3,3,3])), owner)
  await page.goto(origin + '/?unlinked=1&empty-calendar=1' + (width === 320 ? '&large=1' : ''))
  const calendar = page.locator('.lab-up-next button.app-tool').first(), starter = page.getByRole('region', {name: 'Your TiQ'})
  await expect(calendar).toHaveAttribute('data-calendar-state', 'empty')
  await expect(calendar).toContainText('Your calendar'); await expect(calendar).not.toContainText('Up next')
  await expect(calendar).toHaveCSS('border-top-color', 'rgb(54, 87, 133)')
  const update = starter.getByRole('button', {name: 'Update my rating'}), drill = starter.getByRole('button', {name: /^Try /})
  await expect(update).toHaveCSS('background-color', 'rgb(181, 235, 70)')
  await expect(drill).toHaveCSS('background-color', 'rgb(9, 26, 51)')
  const actions = starter.locator('.starter-tiq-actions button'); await expect(actions.first()).toHaveText('Update my rating')
  await starter.scrollIntoViewIfNeeded(); await page.screenshot({path: info.outputPath('my-lab-priorities.png'), scale: 'css'})
  for (const tab of ['My Lab', 'Explore', 'Chats', 'Compete', 'More']) {
    await page.locator('.app-navigation button').filter({hasText: tab}).click()
    await selected(page, tab)
    expect(await page.locator('.app-navigation [aria-current=page]').evaluate(element => getComputedStyle(element, '::before').borderTopColor)).toBe('rgb(181, 235, 70)')
    const inlays = await page.locator('#app button:visible, #app section:visible').evaluateAll(elements => elements.filter(element => getComputedStyle(element).backgroundImage.includes('linear-gradient')).map(element => getComputedStyle(element).backgroundImage))
    expect(inlays.every(image => !image.includes('212, 248, 134'))).toBe(true)
    if (tab === 'Chats') await expect(page.locator('[data-new-player-chat]')).toHaveCSS('background-color', 'rgb(181, 235, 70)')
    await page.screenshot({path: info.outputPath(tab.replaceAll(' ', '-').toLowerCase() + '-palette.png'), scale: 'css'})
  }
})
