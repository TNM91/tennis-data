import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAuthEntryNextIntent } from '../auth-entry-next-intent'
import { buildAuthEntryHref, getAuthEntryPlanId } from '../auth-entry-hrefs'

const joinSource = readFileSync(join(process.cwd(), 'app/join/page.tsx'), 'utf8')
const loginSource = readFileSync(join(process.cwd(), 'app/login/page.tsx'), 'utf8')
const forgotPasswordSource = readFileSync(join(process.cwd(), 'app/forget-password/page.tsx'), 'utf8')
const resetPasswordSource = readFileSync(join(process.cwd(), 'app/reset-password/page.tsx'), 'utf8')
const intentSource = readFileSync(join(process.cwd(), 'lib/auth-entry-next-intent.ts'), 'utf8')

describe('auth entry next intent', () => {
  it('recognizes the Improve starter tactic board through the upgrade handoff', () => {
    const intent = getAuthEntryNextIntent(
      '/upgrade?plan=player_plus&next=%2Ftactics%3Fsource%3Dimprove%26template%3Dcrosscourt%26role%3Dplayer',
    )

    expect(intent).toEqual({
      label: 'After access',
      title: 'Build the starter tactic board.',
      body: 'TenAceIQ keeps the Improve court path attached, then opens Tactical Studio with the crosscourt board ready.',
    })
  })

  it('recognizes a named My Lab proof board through the upgrade handoff', () => {
    const intent = getAuthEntryNextIntent(
      '/upgrade?plan=player_plus&next=%2Ftactics%3Fsource%3Dimprove%26template%3Dcrosscourt%26role%3Dplayer%26card%3Dsplit-step-rhythm%26cardTitle%3DSplit-Step%2520Rhythm',
    )

    expect(intent).toEqual({
      label: 'After access',
      title: 'Build the Split-Step Rhythm proof board.',
      body: 'TenAceIQ keeps the Split-Step Rhythm My Lab proof path attached, then opens Tactical Studio with the crosscourt board ready.',
    })
  })

  it('does not add auth page clutter for ordinary destinations', () => {
    expect(getAuthEntryNextIntent('/profile')).toBeNull()
    expect(getAuthEntryNextIntent('/upgrade?plan=player_plus&next=%2Fprofile')).toBeNull()
  })

  it('surfaces the starter-board next action on join and login', () => {
    for (const phrase of [
      'getAuthEntryNextIntent(selectedNextRoute)',
      'Join next action',
      'Login next action',
    ]) {
      expect(`${joinSource}\n${loginSource}`).toContain(phrase)
    }

    for (const phrase of [
      'Build the starter tactic board.',
      'Build the ${cardTitle} proof board.',
      'Tactical Studio with the crosscourt board ready.',
      'getReadableSearchParam(readableHref, \'cardTitle\')',
    ]) {
      expect(intentSource).toContain(phrase)
    }
  })

  it('keeps a safe requested next route attached when login sends users to account creation', () => {
    expect(loginSource).toContain("buildAuthEntryHref('/join', selectedPlanId, selectedNextRoute, hasSafeRequestedNext)")
    expect(loginSource).toContain('href={createAccountHref}')
    expect(loginSource).not.toContain("href={selectedPlanId === 'free' ? '/join' : `/join?plan=${selectedPlanId}`}")
  })

  it('builds safe auth entry hrefs with plan and next when requested', () => {
    const nextHref = '/upgrade?plan=player_plus&next=%2Ftactics%3Fsource%3Dimprove%26template%3Dcrosscourt%26role%3Dplayer'

    expect(getAuthEntryPlanId('player_plus')).toBe('player_plus')
    expect(getAuthEntryPlanId('bogus')).toBe('free')
    expect(buildAuthEntryHref('/forget-password', 'player_plus', nextHref, true)).toBe(
      '/forget-password?plan=player_plus&next=%2Fupgrade%3Fplan%3Dplayer_plus%26next%3D%252Ftactics%253Fsource%253Dimprove%2526template%253Dcrosscourt%2526role%253Dplayer',
    )
    expect(buildAuthEntryHref('/login', 'free', nextHref, false)).toBe('/login')
  })

  it('keeps the starter-board intent through password recovery and reset', () => {
    for (const phrase of [
      "buildAuthEntryHref('/forget-password', selectedPlanId, selectedNextRoute, hasSafeRequestedNext)",
      'href={forgotPasswordHref}',
      'href={loginHref}',
      'Password recovery next action',
      'Reset password next action',
      'new URL(resetPasswordHref, window.location.origin).toString()',
      'router.push(loginHref)',
    ]) {
      expect(`${loginSource}\n${forgotPasswordSource}\n${resetPasswordSource}`).toContain(phrase)
    }

    expect(forgotPasswordSource).not.toContain("`${window.location.origin}/reset-password`")
    expect(resetPasswordSource).not.toContain("router.push('/login')")
  })
})
