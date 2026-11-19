import {test, expect, type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin = 'http://127.0.0.1:4285'
const id = (n: number) => 'cccccccc-cccc-4ccc-8ccc-' + String(n).padStart(12, '0')
let javascript = '', stylesheet = '', shell = ''
test.describe.configure({retries: 0, timeout: 30000})
test.beforeAll(async () => {
  const bundle = await build({entryPoints: ['tests/fixtures/mobile-navigation.ts'], bundle: true, platform: 'browser', format: 'esm', outfile: 'fixture.js', write: false,
    jsx: 'automatic', define: {TIQ_FIRST_PARTY_BUILD: 'true'}, loader: {'.module.css': 'local-css'},
    alias: {'next/image': path.resolve('mobile/src/native-website-image.tsx'), 'next/link': path.resolve('mobile/src/native-website-link.tsx')},
    plugins: [{name: 'synthetic-coach-assessments', setup(builder) {
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
async function open(page: Page, large = false, history: 'normal' | 'cap' | 'same-day' = 'normal') {
  await page.goto(origin + '/?assessment-history=' + (history === 'normal' ? '1' : history) + (large ? '&large=1' : ''))
  await expect(page.locator('.lab-scoreboard')).toBeVisible()
  await page.getByRole('button', {name: 'More', exact: true}).click()
  await page.locator('[data-app-destination="coach"]').click()
  await page.getByRole('button', {name: 'For coaches', exact: true}).click()
  await page.locator('[data-app-destination="coach-workspace"]').click()
  const workspace = page.getByRole('dialog', {name: 'Coach workspace', exact: true})
  await workspace.getByRole('button', {name: /Alex Rivera/}).click()
  await workspace.getByRole('button', {name: 'Coach assessments', exact: true}).click()
  const dialog = page.getByRole('dialog', {name: 'Coach assessments', exact: true})
  await dialog.locator('.coach-assessment-comparison>summary').click()
  return {dialog, workspace, comparison: dialog.locator('.coach-assessment-comparison')}
}
for (const width of [320, 390]) test('compares observed skills in the same court context without requests while changing dates at ' + width + 'px', async ({page}, info) => {
  await page.setViewportSize({width, height: 844})
  const {dialog, comparison} = await open(page, width === 320, width === 390 ? 'cap' : 'normal')
  await expect(dialog).toContainText(width === 390 ? 'Latest 12 shared assessments' : '6 shared assessments')
  await expect(comparison.getByLabel('Court context', {exact: true})).toHaveValue('drill')
  await expect(comparison.getByLabel('Later assessment', {exact: true})).toHaveValue(id(3))
  await expect(comparison.getByLabel('Earlier assessment', {exact: true})).toHaveValue(id(2))
  await expect(comparison).toContainText('1 higher · 1 same · 1 lower across 3 skills observed in both assessments.')
  const rally = comparison.locator('[data-observation-change=first]')
  await expect(rally).toContainText('Baseline rally')
  await expect(rally).toContainText('EarlierNot observed')
  await expect(rally).toContainText('LaterLearning')
  await expect(comparison.locator('[data-observation-change=unobserved]')).toContainText('Net play')
  await expect(comparison.locator('[data-observation-change=unobserved]')).toContainText('Not observed this time')
  await expect(comparison.locator('[data-comparison-summary]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(comparison.locator('[data-observation-change=higher]')).toHaveCSS('background-color', 'rgb(9, 26, 51)')
  await expect(comparison.getByLabel('Later assessment', {exact: true})).toHaveCSS('background-color', 'rgb(6, 19, 38)')
  const reads = await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture:{reads:number}}).coachAssessmentHistoryFixture.reads)
  await comparison.getByLabel('Later assessment', {exact: true}).selectOption(id(2))
  await expect(comparison.getByLabel('Earlier assessment', {exact: true})).toHaveValue(id(1))
  await expect(comparison.getByLabel('Earlier assessment', {exact: true}).locator('option')).toHaveCount(1)
  await expect(comparison).toContainText('Return · Return Depth Lane')
  const context = comparison.getByLabel('Court context', {exact: true})
  await context.focus(); await context.selectOption('lesson'); await expect(context).toBeFocused()
  await expect(comparison.getByLabel('Later assessment', {exact: true})).toHaveValue(id(5))
  await expect(comparison.getByLabel('Earlier assessment', {exact: true})).toHaveValue(id(4))
  await expect(comparison).toContainText('0 higher · 1 same · 0 lower across 1 skill observed in both assessments.')
  await expect(context.locator('option[value=match]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture:{reads:number}}).coachAssessmentHistoryFixture.reads)).toBe(reads)
  await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 0')
  await context.selectOption('drill')
  await comparison.evaluate(element => element.scrollIntoView({block: 'start'}))
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({path: info.outputPath('coach-assessment-comparison.png'), scale: 'css'})
  await comparison.locator('.coach-comparison-skills').evaluate(element => element.scrollIntoView({block: 'start'}))
  await page.screenshot({path: info.outputPath('coach-assessment-skill-changes.png'), scale: 'css'})
})

test('assigns the selected later assessment’s drill once and retains the comparison through recovery', async ({page}) => {
  const {dialog, workspace, comparison} = await open(page)
  await comparison.getByLabel('Later assessment', {exact: true}).selectOption(id(2))
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-coach-lose]')!.click())
  await comparison.getByRole('button', {name: 'Assign this drill', exact: true}).click()
  await expect(dialog).toContainText('Drill assigned in the player’s My Lab.')
  await expect(comparison).toHaveAttribute('open', '')
  await expect(comparison.getByLabel('Later assessment', {exact: true})).toHaveValue(id(2))
  await expect(comparison).toContainText('Drill assigned')
  await expect(comparison.getByRole('button', {name: 'Assign this drill', exact: true})).toHaveCount(0)
  await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 1')
  await dialog.getByRole('button', {name: 'Close', exact: true}).click()
  await expect(workspace.getByRole('button', {name: /Return Depth Lane/})).toBeVisible()
  await workspace.getByRole('button', {name: 'Coach assessments', exact: true}).click()
  await dialog.locator('.coach-assessment-comparison>summary').click()
  await comparison.getByLabel('Later assessment', {exact: true}).selectOption(id(2))
  await expect(comparison).toContainText('Drill assigned')
  await expect(comparison.getByRole('button', {name: 'Assign this drill', exact: true})).toHaveCount(0)
  await expect(page.locator('[data-coach-writes]')).toHaveText('Coach writes: 1')
})

test('distinguishes observations from the same day at larger text sizes', async ({page}) => {
  await page.setViewportSize({width: 320, height: 844})
  const {dialog, comparison} = await open(page, true, 'same-day')
  const later = comparison.locator('#coach-compare-later-time'), earlier = comparison.locator('#coach-compare-earlier-time')
  await expect(later).not.toBeEmpty(); await expect(earlier).not.toBeEmpty()
  expect(await later.textContent()).not.toBe(await earlier.textContent())
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await comparison.getByLabel('Court context', {exact: true}).selectOption('lesson')
  await expect(later).toBeEmpty(); await expect(earlier).toBeEmpty()
})

test('removes comparison data after an unavailable refresh and an account change', async ({page}) => {
  const {dialog, workspace, comparison} = await open(page)
  await expect(comparison).toContainText('Higher observed level')
  await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture:{failed:boolean}}).coachAssessmentHistoryFixture.failed = true)
  await dialog.getByRole('button', {name: 'Refresh assessments', exact: true}).click()
  await expect(comparison).toHaveCount(0)
  await expect(dialog).toContainText('Coach assessments couldn’t load. Try refreshing.')
  await expect(dialog).not.toContainText('Saved court observation')
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click())
  await expect(dialog).toHaveCount(0)
  await expect(workspace).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Higher observed level')
})

test('keeps the player assessment history and Starter TiQ self rating intact', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('starter-tiq:v2:22222222-2222-4222-8222-222222222222', JSON.stringify({
    current: {date: '2026-11-16', answers: {serve: 2, return: 2, rally: 2, movement: 2, net: 2, points: 2}}, previous: null,
  })))
  const {dialog, workspace} = await open(page)
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click())
  await expect(dialog).toHaveCount(0); await expect(workspace).toHaveCount(0)
  const starter = page.getByRole('region', {name: 'Starter TiQ', exact: true})
  await expect(starter).toContainText('7 / 10')
  const before = await page.evaluate(() => localStorage.getItem('starter-tiq:v2:22222222-2222-4222-8222-222222222222'))
  await starter.getByRole('button', {name: 'Coach assessments', exact: true}).click()
  await expect(dialog).toContainText('Morgan Courts')
  await expect(dialog).toContainText('Self · Steady')
  await expect(dialog.locator('.coach-assessment-comparison')).toHaveCount(0)
  await expect(dialog.getByRole('button', {name: 'New assessment', exact: true})).toHaveCount(0)
  await dialog.getByRole('button', {name: 'Close', exact: true}).click()
  expect(await page.evaluate(() => localStorage.getItem('starter-tiq:v2:22222222-2222-4222-8222-222222222222'))).toBe(before)
  await expect(starter).toContainText('7 / 10')
})
