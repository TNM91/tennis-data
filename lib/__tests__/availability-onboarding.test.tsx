import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { getAvailabilityEntry, matchesAvailabilityTeam } from '../availability-onboarding'
import AvailabilityEntryCard from '@/app/team-availability/availability-entry-card'
import type { TeamConnection } from '../team-profile-links'

const href = '/team-availability?team=Aces&league=Fall&flight=4.0&seasonKey=2027&match=fixture-1'
describe('availability onboarding', () => {
  it('preserves the precise request through signup without carrying private or redirect arguments', () => {
    expect(getAvailabilityEntry(`${href}&responseToken=secret&next=https://evil.test#private`)?.href).toBe(href)
    const html = renderToStaticMarkup(<AvailabilityEntryCard href={href} signedIn={false} />)
    expect(html).toContain(`/join?plan=free&amp;next=${encodeURIComponent(href)}`)
    expect(html).toContain(`/login?next=${encodeURIComponent(href)}`)
    expect(html).toContain('Create free account')
    expect(html).toContain('No paid plan')
    expect(html).toContain('Aces')
    expect(html).not.toContain('/upgrade')
  })
  it.each(['//evil.test/team-availability', '/\\evil.test', '/team-availability', '/profile?team=Aces', '/team-availability?team=Aces&league=Fall', '/team-availability?team=' + 'x'.repeat(2001)])('rejects invalid destinations: %s', value => {
    expect(getAvailabilityEntry(value)).toBeNull()
  })
  it('does not send someone into signup for an incomplete team link', () => {
    const html = renderToStaticMarkup(<AvailabilityEntryCard href="/team-availability" signedIn={false} />)
    expect(html).toContain('Ask for the full team link')
    expect(html).not.toContain('/join')
  })
  it('shows completed account progress without repeating signup', () => {
    const html = renderToStaticMarkup(<AvailabilityEntryCard href={href} signedIn><button>Connect team</button></AvailabilityEntryCard>)
    expect(html).toContain('data-complete="true"')
    expect(html).toContain('Connect team')
    expect(html).not.toContain('/join')
  })
  it('only offers nonarchived server-discovered connections in the exact team scope', () => {
    const connection = { teamName: 'ACES', leagueName: 'Fall', flight: '4.0', archivedAt: '' } as TeamConnection
    expect(matchesAvailabilityTeam(connection, href)).toBe(true)
    for (const different of [{ teamName: 'Other' }, { leagueName: 'Spring' }, { flight: '4.5' }, { archivedAt: 'yesterday' }]) {
      expect(matchesAvailabilityTeam({ ...connection, ...different }, href)).toBe(false)
    }
  })
  it('keeps auth intent focused while preserving the Captain offer and verification', () => {
    const join = readFileSync('app/join/page.tsx', 'utf8')
    expect(join).toContain("selectedPlanId === 'free' ? getAvailabilityEntry(selectedNextRoute) : null")
    expect(join).toContain('!availabilityEntry && password !== confirmPassword')
    expect(join).toContain('if (!acceptedTerms)')
    expect(join).toContain('confirm your email')
    expect(join).toContain('Create account to start 3 months free')
    expect(readFileSync('app/welcome/page.tsx', 'utf8')).toContain('router.replace(availabilityHref)')
  })
  it('keeps player and team linking inline and guards account switching and repeat saves', () => {
    const gate = readFileSync('app/team-availability/team-availability-client.tsx', 'utf8')
    expect(gate).toContain("key={`${userId || 'signed-out'}:${query}`}" )
    expect(gate).toContain("action: 'accept'")
    expect(gate).toContain('matchesAvailabilityTeam(item, href)')
    expect(gate).toContain('AvailabilityPlayerLink token={token}')
    expect(gate).not.toContain('href="/profile"')
    expect(gate).toContain('Your player is connected.')
    expect(gate).toContain('You don’t need to link the same player again.')
    const player = readFileSync('app/team-availability/availability-player-link.tsx', 'utf8')
    expect(player).toContain('controller.abort()')
    expect(player).toContain('if (!selected || lock.current) return')
    expect(player).toContain('await linkAvailabilityPlayer(token, selected.id)')
  })
})
