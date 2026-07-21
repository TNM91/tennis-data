import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAuthEntryNextIntent } from '../auth-entry-next-intent'
import { buildAuthEntryHref, getAuthEntryPlanId } from '../auth-entry-hrefs'

const joinSource = readFileSync(join(process.cwd(), 'app/join/page.tsx'), 'utf8')
const loginSource = readFileSync(join(process.cwd(), 'app/login/page.tsx'), 'utf8')
const forgotPasswordSource = readFileSync(join(process.cwd(), 'app/forget-password/page.tsx'), 'utf8')
const resetPasswordSource = readFileSync(join(process.cwd(), 'app/reset-password/page.tsx'), 'utf8')
const siteHeaderSource = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')
const intentSource = readFileSync(join(process.cwd(), 'lib/auth-entry-next-intent.ts'), 'utf8')
const captainRouteSources = [
  'app/captain/page.tsx',
  'app/captain/availability/page.tsx',
  'app/captain/lineup-availability/page.tsx',
  'app/captain/lineup-builder/page.tsx',
  'app/captain/lineup-projection/page.tsx',
  'app/captain/messaging/page.tsx',
  'app/captain/practice/page.tsx',
  'app/captain/scenario-builder/page.tsx',
  'app/captain/analytics/page.tsx',
  'app/captain/team-brief/page.tsx',
  'app/captain/weekly-brief/page.tsx',
].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')

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

  it('keeps protected Captain routes on the Team Hub login path', () => {
    expect(captainRouteSources).toContain('/login?plan=captain&next=%2Fcaptain')
    expect(captainRouteSources).toContain('/login?plan=captain&next=%2Fcaptain%2Favailability')
    expect(captainRouteSources).toContain('/login?plan=captain&next=%2Fcaptain%2Flineup-builder')
    expect(captainRouteSources).toContain('/login?plan=captain&next=${next}')
    expect(captainRouteSources).not.toContain('/login?next=/captain')
    expect(captainRouteSources).not.toContain('/login?next=${next}')
  })

  it('keeps shared header sign-in intent aligned with Captain and League Office paths', () => {
    expect(siteHeaderSource).toContain("import { buildAuthEntryHref } from '@/lib/auth-entry-hrefs'")
    expect(siteHeaderSource).toContain("const signInNextHref = pathname || '/'")
    expect(siteHeaderSource).toContain("signInNextHref.startsWith('/captain')")
    expect(siteHeaderSource).toContain("signInNextHref.startsWith('/league-coordinator')")
    expect(siteHeaderSource).toContain("const signInHref = buildAuthEntryHref('/login', signInPlanId, signInNextHref, true)")
    expect(siteHeaderSource).toContain("signInPlanId === 'free' ? '/join' : buildAuthEntryHref('/join', signInPlanId, signInNextHref, true)")
    expect(siteHeaderSource).toContain('href={joinHref}')
    expect(siteHeaderSource).not.toContain('const signInHref = `/login?next=${encodeURIComponent(pathname || \'/\')}`')
    expect(siteHeaderSource).not.toContain('href="/join"')
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
