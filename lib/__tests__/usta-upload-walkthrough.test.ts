import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routeSource = readFileSync(join(process.cwd(), 'app/resources/usta-upload/page.tsx'), 'utf8')
const dataAssistSource = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')
const resourcesSource = readFileSync(join(process.cwd(), 'app/resources/page.tsx'), 'utf8')
const sitemapSource = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8')

describe('USTA phone upload walkthrough', () => {
  it('hosts complete and quick videos with posters and English captions', () => {
    for (const asset of [
      'full-walkthrough.mp4',
      'full-walkthrough.vtt',
      'quick-guide.mp4',
      'quick-guide.vtt',
      'thumbnail.jpg',
    ]) {
      expect(existsSync(join(process.cwd(), 'public/help/usta-data-upload', asset)), asset).toBe(true)
    }

    expect(routeSource).toContain('preload="metadata"')
    expect(routeSource).toContain('preload="none"')
    expect(routeSource).toContain('kind="captions"')
    expect(routeSource).toContain('playsInline')
  })

  it('keeps the guide beside the upload action and Resources data-help path', () => {
    expect(dataAssistSource).toContain('<DataAssistWalkthroughHelp />')
    expect(dataAssistSource).toContain('Watch the phone walkthrough first.')
    expect(dataAssistSource).toContain('href="/resources/usta-upload"')
    expect(resourcesSource).toContain("href: '/resources/usta-upload'")
    expect(resourcesSource).toContain("secondaryHref: '/data-assist?intent=upload-source&context=Resources'")
  })

  it('explains the complete path and links directly into Data Assist', () => {
    expect(routeSource).toContain('Upload USTA data without the guesswork.')
    expect(routeSource).toContain('Four simple moves')
    expect(routeSource).toContain('Start an upload')
    expect(routeSource).toContain('/data-assist?intent=upload-source&context=USTA%20phone%20walkthrough')
    expect(routeSource).toContain('not affiliated with or endorsed by USTA')
    expect(sitemapSource).toContain("path: '/resources/usta-upload'")
  })
})
