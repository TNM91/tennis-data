import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')

describe('Data Assist Captain handoff', () => {
  it('returns a completed Captain schedule import to Captain setup', () => {
    expect(source).toContain('context={intentContext}')
    expect(source).toContain("actions={buildSchedulePostImportActions(parsedDraft, context)}")
    expect(source).toContain("actions.push({ label: 'Continue Captain setup', href: '/captain' })")
    expect(source).toContain('acceptCaptainImportConnection')
    expect(source).toContain('buildCaptainImportReturnHref(returnTo, handoff)')
  })

  it('opens Player Roster help and returns a completed roster import to Build Lineup', () => {
    expect(source).toContain("const requestedImportType = getRequestedImportType(searchParams.get('type'))")
    expect(source).toContain("const exportHelpRequested = searchParams.get('help') === '1'")
    expect(source).toContain("const returnTo = getSafeDataAssistReturnTo(searchParams.get('returnTo'))")
    expect(source).toContain('defaultOpen={exportHelpRequested}')
    expect(source).toContain('context={intentContext}')
    expect(source).toContain('returnTo={returnTo}')
    expect(source).toContain("? 'Return to Build Lineup' : 'Continue Captain setup'")
    expect(source).toContain('isCaptainImportDraft(submission.parsedPayload)')
    expect(source).toContain('finishCaptainImport')
  })

  it('returns a Team Room scorecard import to the same team conversation', () => {
    expect(source).toContain("if (path === '/team-room' || path.startsWith('/team-room?')) return path")
    expect(source).toContain('actions={buildScorecardPostImportActions(parsedDraft, returnTo)}')
    expect(source).toContain("returnTo.startsWith('/team-room') ? 'Return to Team Chat' : 'Continue Captain'")
  })
})
