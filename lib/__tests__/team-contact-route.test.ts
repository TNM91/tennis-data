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

  it('keeps individual mobile saves on the team roster and merges them with imported contacts', () => {
    expect(source).toContain("supabase\n        .from('captain_message_contacts')")
    expect(source).toContain('mergeCaptainTeamContacts')
    expect(source).toContain('<InlineRosterContactEditor')
    expect(source).toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })
})
