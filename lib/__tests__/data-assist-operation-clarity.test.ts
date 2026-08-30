import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8').replace(/\r\n/g, '\n')

describe('Data Assist upload operation clarity', () => {
  it('keeps an imported roster outcome visible and linked to its saved record', () => {
    expect(source).toContain('type DataAssistOutcome')
    expect(source).toContain('function DataAssistOutcomePanel')
    expect(source).toContain('data-data-assist-outcome={outcome.tone}')
    expect(source).toContain("title: 'Roster imported'")
    expect(source).toContain('buildImportedDataAssistOutcome(ocrResult.parsedDraft, result.batchId)')
    expect(source).toContain('setFocusedSubmissionId(nextOutcome?.batchId || \'\')')
    expect(source).toContain('Open import record')
    expect(source).toContain('Upload another')
    expect(source).toContain("? 'imported'\n    : 'needs_review'")
    expect(source).toContain('initialHistoryFilter={focusedHistoryFilter}')
  })

  it('brings unresolved uploads forward as a clear review action', () => {
    expect(source).toContain('buildReviewDataAssistOutcome(ocrResult.parsedDraft, result.batchId)')
    expect(source).toContain("title: `${getDataAssistImportTypeLabel(getParsedDraftImportType(parsedDraft))} review ready`")
    expect(source).toContain('TiQ saved the upload but will not change player, team, league, or rating records')
    expect(source).toContain('data-data-assist-operation="review"')
    expect(source).toContain('Open the review queue')
    expect(source).toContain("openHistory('needs_review')")
  })

  it('makes review and history large operational controls instead of hidden details', () => {
    expect(source).toContain('function DataAssistOperationsPanel')
    expect(source).toContain('Needs your review')
    expect(source).toContain('Import history')
    expect(source).toContain('data-data-assist-operation="history"')
    expect(source).toContain('const dataAssistOperationsStyle: CSSProperties')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'")
    expect(source).toContain('forceHistoryOpen={Boolean(outcome)}')
  })
})
