import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV_ITEMS, FOOTER_NAV_SECTIONS, ACCOUNT_NAV_ITEMS, CAPTAIN_QUICK_NAV_ITEMS, COACH_QUICK_NAV_ITEMS } from '../site-navigation'

describe('site navigation language', () => {
  it('uses the public action-based navigation map', () => {
    expect(PRIMARY_NAV_ITEMS).toEqual([
      { href: '/explore', label: 'Find' },
      { href: '/matchup', label: 'Prepare' },
      { href: '/mylab', label: 'Improve' },
      { href: '/coaches', label: 'Coaches' },
      { href: '/teams', label: 'Teams' },
      { href: '/tournaments', label: 'Tournaments' },
      { href: '/leagues', label: 'Leagues' },
      { href: '/resources', label: 'Resources' },
      { href: '/pricing', label: 'Pricing' },
    ])

    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Find',
      'Prepare',
      'Improve',
      'Coaches',
      'Teams',
      'Tournaments',
      'Leagues',
      'Resources',
      'Pricing',
    ])
    expect(PRIMARY_NAV_ITEMS).not.toContainEqual({ href: '/captain', label: 'Captains' })
  })

  it('keeps footer sections aligned to the same user-facing modes', () => {
    const sectionTitles = FOOTER_NAV_SECTIONS.map((section) => section.title)

    expect(sectionTitles).toContain('Find')
    expect(sectionTitles).toContain('Improve')
    expect(sectionTitles).toContain('Coaches')
    expect(sectionTitles).toContain('Teams')
    expect(sectionTitles).toContain('Leagues and tournaments')
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
      { href: '/coaches', label: 'Find coaches' },
      { href: '/coach', label: 'Coach Hub' },
      { href: '/tactics', label: 'Tactical Studio' },
      { href: '/player-development', label: 'Development paths' },
      { href: '/player-development/relentless-competitor-4-0/coach-planner', label: 'Coach planner' },
    ])
  })

  it('surfaces Coach from account quick navigation', () => {
    expect(ACCOUNT_NAV_ITEMS).toContainEqual({ href: '/coach', label: 'Coach Hub' })
  })
})
