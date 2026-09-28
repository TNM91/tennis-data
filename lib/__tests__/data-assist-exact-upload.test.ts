import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dataAssistSource = readFileSync(join(process.cwd(), 'lib/data-assist.ts'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')

describe('Data Assist exact upload protection', () => {
  it('reuses an imported non-scorecard batch when the file fingerprint is unchanged', () => {
    expect(dataAssistSource).toContain("summary.requestedImportType !== 'scorecard'")
    expect(dataAssistSource).toContain(".eq('client_fingerprint', screenshot.clientFingerprint)")
    expect(dataAssistSource).toContain(".eq('status', 'imported')")
    expect(dataAssistSource).toContain('exactDuplicate: true')
  })

  it('reprocesses legacy Player Rosters that previously saved contacts without membership', () => {
    expect(dataAssistSource).toContain(".select('id, validation_summary, parsed_payload')")
    expect(dataAssistSource).toContain("savedDraft?.parsed_payload?.rosterSource === 'player_roster'")
    expect(dataAssistSource).toContain('savedDraft.validation_summary?.importSummary?.contactOnly === true')
    expect(dataAssistSource).toContain('if (legacyContactOnlyPlayerRoster) return null')
  })

  it('lets the user keep the saved import or deliberately import the same file again', () => {
    expect(pageSource).toContain('This exact file is already imported.')
    expect(pageSource).toContain('Use saved import')
    expect(pageSource).toContain('Import again anyway')
    expect(pageSource).toContain('saveDataAssistDraftBatch(draftSummary, { allowExactDuplicate })')
  })
})
