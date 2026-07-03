import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAuthEntryNextIntent } from '../auth-entry-next-intent'

const joinSource = readFileSync(join(process.cwd(), 'app/join/page.tsx'), 'utf8')
const loginSource = readFileSync(join(process.cwd(), 'app/login/page.tsx'), 'utf8')
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
      'Tactical Studio with the crosscourt board ready.',
    ]) {
      expect(intentSource).toContain(phrase)
    }
  })

  it('keeps a safe requested next route attached when login sends users to account creation', () => {
    expect(loginSource).toContain('buildLoginJoinHref(selectedPlanId, selectedNextRoute, hasSafeRequestedNext)')
    expect(loginSource).toContain("params.set('next', nextHref)")
    expect(loginSource).toContain('href={createAccountHref}')
    expect(loginSource).not.toContain("href={selectedPlanId === 'free' ? '/join' : `/join?plan=${selectedPlanId}`}")
  })
})
