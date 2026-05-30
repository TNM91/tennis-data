import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const robotsSource = readFileSync(join(process.cwd(), 'app/robots.ts'), 'utf8')
const previewHomePage = readFileSync(join(process.cwd(), 'app/preview-home/page.tsx'), 'utf8')
const noindexRouteFiles = [
  'app/admin/layout.tsx',
  'app/captain/layout.tsx',
  'app/captain/season-dashboard/layout.tsx',
  'app/coach/layout.tsx',
  'app/compete/layout.tsx',
  'app/league-coordinator/layout.tsx',
  'app/messages/layout.tsx',
  'app/mylab/layout.tsx',
  'app/profile/layout.tsx',
  'app/login/layout.tsx',
  'app/join/layout.tsx',
  'app/forget-password/layout.tsx',
  'app/reset-password/layout.tsx',
  'app/tournaments/[id]/preferences/layout.tsx',
  'app/upgrade/layout.tsx',
  'app/preview-home/page.tsx',
  'app/tactics/page.tsx',
] as const

describe('public and private indexing boundaries', () => {
  it('disallows private workspaces without blocking public sections', () => {
    expect(robotsSource).toContain("'/coach/'")
    expect(robotsSource).toContain("'/league-coordinator/'")
    expect(robotsSource).toContain("'/messages'")
    expect(robotsSource).toContain("'/profile'")
    expect(robotsSource).toContain("'/preview-home'")
    expect(robotsSource).toContain("'/tactics'")
    expect(robotsSource).toContain("'/tournaments/*/preferences'")
    expect(robotsSource).toContain("'/upgrade'")

    expect(robotsSource).not.toContain("'/coaches'")
    expect(robotsSource).not.toContain("'/tournaments',")
    expect(robotsSource).not.toContain("'/resources'")
    expect(robotsSource).not.toContain("'/data-assist'")
  })

  it('marks private layouts noindex and nofollow', () => {
    for (const path of noindexRouteFiles) {
      const source = readFileSync(join(process.cwd(), path), 'utf8')

      expect(source).toContain('robots')
      expect(source).toContain('index: false')
      expect(source).toContain('follow: false')
    }
  })

  it('keeps the legacy homepage preview out of indexing', () => {
    expect(previewHomePage).toContain('robots')
    expect(previewHomePage).toContain('index: false')
    expect(previewHomePage).toContain('follow: false')
  })
})
