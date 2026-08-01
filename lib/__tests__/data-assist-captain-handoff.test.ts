import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')

describe('Data Assist Captain handoff', () => {
  it('returns a completed Captain schedule import to Captain setup', () => {
    expect(source).toContain('context={intentContext}')
    expect(source).toContain("actions={buildSchedulePostImportActions(parsedDraft, context)}")
    expect(source).toContain("actions.push({ label: 'Continue Captain setup', href: '/captain' })")
  })
})
