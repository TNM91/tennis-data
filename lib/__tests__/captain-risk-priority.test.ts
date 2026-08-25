import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

describe('Captain match-week risk priority', () => {
  it('keeps active match-week alerts from counting as availability-ready', () => {
    expect(source).toContain('complete: workspaceState.pendingResponseCount === 0 && workspaceState.responseAlertCount === 0')
  })

  it('routes an active alert to availability before the normal weekly action', () => {
    expect(source).toContain('const captainRiskAction = useMemo(() =>')
    expect(source).toContain('if (workspaceState.responseAlertCount <= 0) return null')
    expect(source).toContain('title: `Resolve ${alertLabel}`')
    expect(source).toContain("href: availabilityHref")
    expect(source).toContain("cta: 'Review availability'")
    expect(source).toContain('const captainPrimaryAction = captainRiskAction ?? (captainReadinessScore < 100 ? {')
  })
})
