import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV_ITEMS, FOOTER_NAV_SECTIONS, ACCOUNT_NAV_ITEMS, CAPTAIN_QUICK_NAV_ITEMS, COACH_QUICK_NAV_ITEMS } from '../site-navigation'
import { PRODUCT_MODE_LANGUAGE } from '../product-story'

describe('site navigation language', () => {
  it('sources primary nav labels and routes from the product mode language contract', () => {
    expect(PRIMARY_NAV_ITEMS).toEqual([
      { href: PRODUCT_MODE_LANGUAGE.find.route, label: PRODUCT_MODE_LANGUAGE.find.label },
      { href: PRODUCT_MODE_LANGUAGE.you.route, label: PRODUCT_MODE_LANGUAGE.you.label },
      { href: PRODUCT_MODE_LANGUAGE.coach.route, label: PRODUCT_MODE_LANGUAGE.coach.label },
      { href: PRODUCT_MODE_LANGUAGE.team.route, label: PRODUCT_MODE_LANGUAGE.team.label },
      { href: PRODUCT_MODE_LANGUAGE.league.route, label: PRODUCT_MODE_LANGUAGE.league.label },
      { href: PRODUCT_MODE_LANGUAGE.plans.route, label: PRODUCT_MODE_LANGUAGE.plans.label },
    ])

    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Explore',
      'My Lab',
      'Coach',
      'Team',
      'Leagues',
      'Pricing',
    ])
    expect(PRIMARY_NAV_ITEMS).not.toContainEqual({ href: PRODUCT_MODE_LANGUAGE.prep.route, label: PRODUCT_MODE_LANGUAGE.prep.label })
  })

  it('keeps footer sections aligned to the same user-facing modes', () => {
    const sectionTitles = FOOTER_NAV_SECTIONS.map((section) => section.title)

    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.find.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.you.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.coach.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.team.label)
    expect(sectionTitles).toContain(PRODUCT_MODE_LANGUAGE.league.label)
  })

  it('keeps Captain quick links aligned with the Team portal actions', () => {
    expect(CAPTAIN_QUICK_NAV_ITEMS).toEqual([
      { href: '/captain/availability', label: 'Who can play' },
      { href: '/captain/practice', label: 'Plan practice' },
      { href: '/tactics', label: 'Map tactics' },
      { href: '/captain/lineup-builder', label: 'Build lineup' },
      { href: '/captain/messaging', label: 'Send plan' },
    ])
  })

  it('keeps Coach quick links aligned with the Coach lane', () => {
    expect(COACH_QUICK_NAV_ITEMS).toEqual([
      { href: '/coach', label: 'Coach workspace' },
      { href: '/tactics', label: 'Tactical Studio' },
      { href: '/player-development', label: 'Development paths' },
      { href: '/player-development/relentless-competitor-4-0/coach-planner', label: 'Coach planner' },
    ])
  })

  it('surfaces Coach from account quick navigation', () => {
    expect(ACCOUNT_NAV_ITEMS).toContainEqual({ href: '/coach', label: 'Coach workspace' })
  })
})
