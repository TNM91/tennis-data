import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team contact route', () => {
  it('keeps captain contact work in the selected team roster', () => {
    expect(source).toContain("const contactHubRequested = searchParams.get('contacts') === '1'")
    expect(source).toContain('const teamContactReturnHref = `${teamProfileHref}')
    expect(source).toContain("#team-roster-contacts")
    expect(source).toContain('const teamContactImportHref = `/data-assist?intent=upload-source&context=Team%20contacts&type=team_summary&contactImport=1')
    expect(source).toContain('Add Player Roster')
    expect(source).toContain('Edit contacts here')
    expect(source).not.toContain("const teamContactsBaseHref = buildCaptainScopedHref('/captain/messaging'")
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
    expect(source).toContain("if (item.id === 'lineup')")
    expect(source).toContain('scroll')
    expect(source).toContain("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })")
  })

  it('only asks for the mobile number in the inline roster contact editor', () => {
    const inlineEditor = source.slice(source.indexOf('function InlineRosterContactEditor'))
    expect(inlineEditor).toContain('Mobile number')
    expect(inlineEditor).not.toContain('Email (optional)')
    expect(inlineEditor).not.toContain('initialEmail')
  })
})
