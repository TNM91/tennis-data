import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/data-assist-import-runner.ts'), 'utf8')

describe('Data Assist Player Roster contacts', () => {
  it('branches Player Roster imports into the contact-only flow before Team Summary ingestion', () => {
    const actionStart = source.indexOf('export async function runDataAssistTeamSummaryImportAction')
    const contactOnlyBranch = source.indexOf("if (input.parsedDraft.rosterSource === 'player_roster')")
    const teamSummaryImport = source.indexOf('const payload = buildDataAssistTeamSummaryPayload')

    expect(contactOnlyBranch).toBeGreaterThan(actionStart)
    expect(contactOnlyBranch).toBeLessThan(teamSummaryImport)
    expect(source).toContain('runDataAssistPlayerRosterContactImportAction(input)')
    expect(source).toContain('will be saved without changing the Team Summary.')
    expect(source).toContain('Your Team Summary was not changed.')
    expect(source).not.toContain("import { syncAuthoritativeCaptainRoster, upsertCaptainRosterContacts } from './captain-roster-contacts'")
  })
})
