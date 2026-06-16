import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV_ITEMS } from '../site-navigation'

const headerSource = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')

describe('site header mobile navigation descriptions', () => {
  it('uses the product motto and benefit-led descriptions in the compact menu', () => {
    expect(headerSource).toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(headerSource).toContain('{PRODUCT_MOTTO} Pick the tennis job you need solved.')
    expect(headerSource).toContain('function MobileItemLabel')
    expect(headerSource).toContain('<MobileItemLabel label={item.label} description={item.description} />')
    expect(headerSource).toContain('const mobileMenuCueStyle')
    expect(headerSource).toContain('const mobileItemDescriptionStyle')
  })

  it('keeps every primary mobile nav item tied to More Tennis. Less Chaos. jobs', () => {
    expect(PRIMARY_NAV_ITEMS).toHaveLength(7)
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Explore',
      'Improve',
      'Compete',
      'Manage',
      'Coaches',
      'Leagues & Tournaments',
      'My Lab',
    ])

    for (const item of PRIMARY_NAV_ITEMS) {
      expect(item.description).toBeTruthy()
      expect(item.description?.length).toBeGreaterThan(20)
    }

    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/manage')?.description).toContain('schedules')
    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/leagues-and-tournaments')?.description).toContain('scores')
    expect(PRIMARY_NAV_ITEMS.find((item) => item.href === '/mylab')?.description).toContain('personal tennis home')
  })

  it('keeps mobile nav text wrap-safe', () => {
    expect(headerSource).toContain("fontSize: '12px'")
    expect(headerSource).toContain('lineHeight: 1.35')
    expect(headerSource).toContain("display: 'grid'")
    expect(headerSource).toContain("overflowWrap: 'anywhere'")
    expect(headerSource).toContain("minWidth: 0")
  })
})
