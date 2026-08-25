import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')

describe('Captain messaging reply pulse', () => {
  it('surfaces reply blockers in the mobile send pulse without squeezing the cards', () => {
    expect(source).toContain("label: 'Replies'")
    expect(source).toContain("? `${responseSummary.noResponseCount + responseSummary.needSubCount + responseSummary.runningLateCount} open`")
    expect(source).toContain("? `${responseSummary.needSubCount} need a sub`")
    expect(source).toContain("? `${responseSummary.runningLateCount} running late`")
    expect(source).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(source).toContain("gridColumn: '1 / -1'")
  })
})
