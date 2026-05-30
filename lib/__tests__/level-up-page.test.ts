import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/level-up/page.tsx'), 'utf8')
const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const navSource = readFileSync(join(process.cwd(), 'lib/site-navigation.ts'), 'utf8')
const sitemapSource = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8')
const trainingMenusSource = readFileSync(join(process.cwd(), 'lib/player-training-menus.ts'), 'utf8')
const developmentSystemSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-system.tsx'), 'utf8')

describe('Level Up page', () => {
  it('creates a direct phone-first Level Up destination from the shared drill engine', () => {
    expect(existsSync(join(process.cwd(), 'app/level-up/page.tsx'))).toBe(true)
    expect(pageSource).toContain('PlayerLiveWorkbench')
    expect(pageSource).toContain('getPlayerTrainingMenus')
    expect(pageSource).toContain('Start now')
    expect(pageSource).toContain('/mylab#coach-assignments')
    expect(pageSource).toContain('Choose development identity')
  })

  it('surfaces Level Up from My Lab, navigation, and the sitemap', () => {
    expect(myLabSource).toContain('Level Up now')
    expect(myLabSource).toContain('href="/level-up"')
    expect(navSource).toContain("{ href: '/level-up', label: 'Level Up' }")
    expect(sitemapSource).toContain("{ path: '/level-up'")
  })

  it('keeps workbook and route drill menus in one shared source', () => {
    expect(trainingMenusSource).toContain('Serve target reps')
    expect(trainingMenusSource).toContain('First-strike conditioning')
    expect(developmentSystemSource).toContain("from '@/lib/player-training-menus'")
    expect(developmentSystemSource).not.toContain('function getPlayerTrainingMenus')
  })
})
