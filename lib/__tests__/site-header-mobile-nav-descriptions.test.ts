import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV_ITEMS } from '../site-navigation'

const headerSource = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')

describe('site header mobile navigation descriptions', () => {
  it('uses short job descriptions in the compact menu', () => {
    expect(headerSource).not.toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(headerSource).not.toContain('Pick the tennis support you need next.')
    expect(headerSource).not.toContain('Search public tennis context first, then open the tool that fits your next match, team, or season.')
    expect(headerSource).toContain('function MobileItemLabel')
    expect(headerSource).toContain('<MobileItemLabel label={item.label} description={item.description} />')
    expect(headerSource).toContain('const mobileItemDescriptionStyle')
  })

  it('keeps every primary mobile nav item tied to More Tennis. Less Chaos. jobs', () => {
    expect(PRIMARY_NAV_ITEMS).toHaveLength(7)
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Explore',
      'Improve',
      'Compete',
      'Teams',
      'Coaches',
      'Leagues',
      'Club',
    ])

    for (const item of PRIMARY_NAV_ITEMS) {
      expect(item.description).toBeTruthy()
      expect(item.description?.length).toBeLessThan(42)
    }

    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/compete/teams')?.description).toContain('Team Chat')
    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/player-development')?.description).toContain('video')
    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/leagues-and-tournaments')?.description).toContain('scores')
    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/clubs')?.description).toContain('Programs')
  })

  it('keeps mobile nav text wrap-safe', () => {
    expect(headerSource).toContain("fontSize: '12px'")
    expect(headerSource).toContain('lineHeight: 1.35')
    expect(headerSource).toContain("display: 'grid'")
    expect(headerSource).toContain("overflowWrap: 'anywhere'")
    expect(headerSource).toContain("minWidth: 0")
  })
})
