import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team contact route', () => {
  it('uses the dedicated captain messaging route for roster contact actions', () => {
    expect(source).toContain("const teamContactsBaseHref = buildCaptainScopedHref('/captain/messaging', {")
    expect(source).toContain('const teamContactsHref = `${teamContactsBaseHref}')
    expect(source).toContain("contactView=all#captain-contact-manager")
  })

  it('keeps individual mobile saves on the team roster through the authenticated Captain API', () => {
    expect(source).toContain("fetch('/api/captain/team-contacts'")
    expect(source).toContain('Authorization: `Bearer ${accessToken}`')
    expect(source).toContain('setCaptainRosterContacts((current) => [')
    expect(source).toContain('<InlineRosterContactEditor')
    expect(source).toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })

  it('keeps Build lineup in the team quick links for captains', () => {
    expect(source).toContain("{ id: 'lineup', label: 'Build lineup', href: captainLinks[1].href, primary: true }")
    expect(source).toContain('teamSectionNavLineupMobileStyle')
  })

  it('only asks for the mobile number in the inline roster contact editor', () => {
    const inlineEditor = source.slice(source.indexOf('function InlineRosterContactEditor'))
    expect(inlineEditor).toContain('Mobile number')
    expect(inlineEditor).not.toContain('Email (optional)')
    expect(inlineEditor).not.toContain('initialEmail')
  })
})
