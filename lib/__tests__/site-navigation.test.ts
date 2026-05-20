import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV_ITEMS, FOOTER_NAV_SECTIONS } from '../site-navigation'
import { PRODUCT_MODE_LANGUAGE } from '../product-story'

describe('site navigation language', () => {
  it('sources primary nav labels and routes from the product mode language contract', () => {
    expect(PRIMARY_NAV_ITEMS).toEqual([
      { href: PRODUCT_MODE_LANGUAGE.find.route, label: PRODUCT_MODE_LANGUAGE.find.label },
      { href: PRODUCT_MODE_LANGUAGE.you.route, label: PRODUCT_MODE_LANGUAGE.you.label },
      { href: PRODUCT_MODE_LANGUAGE.prep.route, label: PRODUCT_MODE_LANGUAGE.prep.label },
      { href: PRODUCT_MODE_LANGUAGE.team.route, label: PRODUCT_MODE_LANGUAGE.team.label },
      { href: PRODUCT_MODE_LANGUAGE.league.route, label: PRODUCT_MODE_LANGUAGE.league.label },
      { href: PRODUCT_MODE_LANGUAGE.plans.route, label: PRODUCT_MODE_LANGUAGE.plans.label },
    ])
  })

  it('keeps footer sections aligned to the same user-facing modes', () => {
    const sectionTitles = FOOTER_NAV_SECTIONS.map((section) => section.title)

    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.find.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.you.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.team.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.league.label)
  })
})
