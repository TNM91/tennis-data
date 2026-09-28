import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/data-assist-import-runner.ts'), 'utf8')

describe('Data Assist Player Roster contacts', () => {
  it('imports Player Roster membership and contacts through the authoritative roster flow', () => {
    const actionStart = source.indexOf('export async function runDataAssistTeamSummaryImportAction')
    const teamSummaryImport = source.indexOf('const payload = buildDataAssistTeamSummaryPayload')

    expect(teamSummaryImport).toBeGreaterThan(actionStart)
    expect(source).toContain("import { syncAuthoritativeCaptainRoster, upsertCaptainRosterContacts } from './captain-roster-contacts'")
    expect(source).toContain('await syncAuthoritativeCaptainRoster({')
    expect(source).toContain('importedContactCount = await upsertCaptainRosterContacts({')
    expect(source).not.toContain('runDataAssistPlayerRosterContactImportAction(input, refreshComparison)')
    expect(source).not.toContain('Your Team Summary was not changed.')
  })
})
