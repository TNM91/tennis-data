import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV_ITEMS, FOOTER_NAV_SECTIONS, ACCOUNT_NAV_ITEMS, CAPTAIN_QUICK_NAV_ITEMS, COACH_QUICK_NAV_ITEMS } from '../site-navigation'
import { CAPTAIN_TACTICS_BOARD_HREF, COACH_TACTICS_BOARD_HREF, PLAYER_TACTICS_BOARD_HREF } from '../tactics-hrefs'

describe('site navigation language', () => {
  it('uses the community-centered platform navigation map', () => {
    expect(PRIMARY_NAV_ITEMS).toEqual([
      { href: '/explore', label: 'Explore', description: 'Find players, teams, leagues, rankings, and public tennis context.' },
      { href: '/player-development', label: 'Improve', description: 'Choose what to work on, find drills, and level up faster.' },
      { href: '/compete', label: 'Compete', description: 'Prepare matchups, scout opponents, and track performance.' },
      { href: '/manage', label: 'Manage', description: 'Run teams, schedules, availability, scores, and communication.' },
      { href: '/coaches', label: 'Coaches', description: 'Find coaching support and keep player development moving.' },
      { href: '/leagues-and-tournaments', label: 'Leagues & Tournaments', description: 'Organize seasons, events, players, teams, scores, and results.' },
      { href: '/mylab', label: 'My Lab', description: 'Open your personal tennis home for insights, prep, and progress.' },
    ])

    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Explore',
      'Improve',
      'Compete',
      'Manage',
      'Coaches',
      'Leagues & Tournaments',
      'My Lab',
    ])
    expect(PRIMARY_NAV_ITEMS.every((item) => item.description && item.description.length > 20)).toBe(true)
    expect(PRIMARY_NAV_ITEMS.map((item) => item.description)).toContain('Choose what to work on, find drills, and level up faster.')
    expect(PRIMARY_NAV_ITEMS).not.toContainEqual({ href: '/captain', label: 'Captains' })
  })

  it('keeps footer sections aligned to the same user-facing modes', () => {
    const sectionTitles = FOOTER_NAV_SECTIONS.map((section) => section.title)

    expect(sectionTitles).toContain('Explore')
    expect(sectionTitles).toContain('Improve')
    expect(sectionTitles).toContain('Compete')
    expect(sectionTitles).toContain('Manage')
    expect(sectionTitles).toContain('Coaches')
    expect(sectionTitles).toContain('Leagues and tournaments')
  })

  it('starts the leagues and tournaments footer path at the organizer hub', () => {
    const organizerSection = FOOTER_NAV_SECTIONS.find((section) => section.title === 'Leagues and tournaments')

    expect(organizerSection?.items.at(0)).toEqual({ href: '/leagues-and-tournaments', label: 'Organizer hub' })
    expect(organizerSection?.items).toContainEqual({ href: '/league-coordinator/tournaments', label: 'Build tournament' })
  })

  it('keeps the resource hub discoverable from the Improve footer path', () => {
    const improveSection = FOOTER_NAV_SECTIONS.find((section) => section.title === 'Improve')

    expect(improveSection?.items).toContainEqual({ href: '/resources', label: 'Resource hub' })
    expect(improveSection?.items.findIndex((item) => item.href === '/resources')).toBeGreaterThan(
      improveSection?.items.findIndex((item) => item.href === '/player-development') ?? -1,
    )
  })

  it('uses plain tennis wording for Data Assist navigation', () => {
    const improveSection = FOOTER_NAV_SECTIONS.find((section) => section.title === 'Improve')

    expect(ACCOUNT_NAV_ITEMS).toContainEqual({ href: '/data-assist', label: 'Fix tennis info' })
    expect(improveSection?.items).toContainEqual({ href: '/data-assist', label: 'Fix tennis info' })
    expect(ACCOUNT_NAV_ITEMS).not.toContainEqual({ href: '/data-assist', label: 'Improve data' })
  })

  it('keeps Captain quick links aligned with the Team portal actions', () => {
    expect(CAPTAIN_QUICK_NAV_ITEMS).toEqual([
      { href: '/captain/availability', label: 'Who can play' },
      { href: '/captain/practice', label: 'Plan practice' },
      { href: CAPTAIN_TACTICS_BOARD_HREF, label: 'Map tactics' },
      { href: '/captain/lineup-builder', label: 'Build lineup' },
      { href: '/captain/messaging', label: 'Send plan' },
    ])
  })

  it('keeps Coach quick links aligned with the Coach lane', () => {
    expect(COACH_QUICK_NAV_ITEMS).toEqual([
      { href: '/coaches', label: 'Find coaches' },
      { href: '/coach', label: 'Coach Hub' },
      { href: COACH_TACTICS_BOARD_HREF, label: 'Tactical Studio' },
      { href: '/player-development', label: 'Development paths' },
      { href: '/player-development/relentless-competitor-4-0/coach-planner', label: 'Coach planner' },
    ])
  })

  it('surfaces Coach from account quick navigation', () => {
    expect(ACCOUNT_NAV_ITEMS).toContainEqual({ href: '/coach', label: 'Coach Hub' })
    expect(ACCOUNT_NAV_ITEMS).toContainEqual({ href: PLAYER_TACTICS_BOARD_HREF, label: 'Tactics Tools' })
  })
})
