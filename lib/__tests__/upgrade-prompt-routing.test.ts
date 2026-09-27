import { describe, expect, it } from 'vitest'
import { getUpgradePromptHref } from '../upgrade-prompt-routing'

describe('locked-feature checkout routing', () => {
  it('takes public Player unlocks to sign-in with checkout and My Lab preserved', () => {
    const href = getUpgradePromptHref('player_plus', undefined, true, false)
    const login = new URL(href, 'https://tenaceiq.invalid')
    expect(login.pathname).toBe('/login')
    const checkout = new URL(login.searchParams.get('next')!, login.origin)
    expect(checkout.searchParams.get('plan')).toBe('player_plus')
    expect(checkout.searchParams.get('next')).toBe('/mylab')
    expect(checkout.searchParams.get('checkout')).toBe('auto')
  })

  it('preserves a locked tool destination and source when opening checkout', () => {
    const href = getUpgradePromptHref('player_plus', '/upgrade?plan=player_plus&next=%2Ftactics%3Fsource%3Dimprove%23court&source=tool', true, true)
    const checkout = new URL(href, 'https://tenaceiq.invalid')
    expect(checkout.searchParams.get('next')).toBe('/tactics?source=improve#court')
    expect(checkout.searchParams.get('source')).toBe('tool')
    expect(checkout.searchParams.getAll('checkout')).toEqual(['auto'])
  })

  it('keeps explicit browsing and payment-recovery links intact', () => {
    for (const href of ['/pricing', '/captain-pilot', '/upgrade?plan=captain', '/upgrade?plan=player_plus&checkout=success&request=r&session_id=cs']) {
      expect(getUpgradePromptHref('player_plus', href, true, false)).toBe(href)
    }
  })

  it('keeps paused checkout and Free actions on their existing routes', () => {
    expect(getUpgradePromptHref('player_plus', undefined, false, false)).toBe('/upgrade?plan=player_plus&next=%2Fprofile')
    expect(getUpgradePromptHref('captain', '/captain-pilot', false, true)).toBe('/captain-pilot')
    expect(getUpgradePromptHref('free', undefined, true, false)).toBe('/explore')
  })
})
