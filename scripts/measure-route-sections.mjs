import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://127.0.0.1:3001/level-up'
const width = Number(process.argv[3] ?? 390)
const height = Number(process.argv[4] ?? 844)
const selector = process.argv[5] ?? 'main > section, main > details, main > nav, main > div'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
await page.waitForTimeout(300)

const result = await page.evaluate((targetSelector) => {
  const labelFor = (element) => (
    element.getAttribute('aria-label')
    || element.getAttribute('aria-labelledby')
    || element.id
    || [...element.classList].join('.')
    || element.tagName
  )

  const sections = [...document.querySelectorAll(targetSelector)]
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        tag: element.tagName,
        label: labelFor(element),
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height),
      }
    })
    .filter((entry) => entry.height > 0)
    .sort((a, b) => b.height - a.height)

  return {
    title: document.title,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    sections,
  }
}, selector)

await browser.close()
console.log(JSON.stringify(result, null, 2))
