import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

describe('Captain mobile availability risk', () => {
  it('includes availability in the phone match card with an explicit alert state', () => {
    expect(source).toContain("label: 'Availability'")
    expect(source).toContain('state: workspaceState.responseAlertCount > 0')
    expect(source).toContain("? 'Resolve late-arrival or substitution risk before you send the reminder.'")
    expect(source).toContain("tone: workspaceState.responseAlertCount > 0 || workspaceState.pendingResponseCount > 0 ? 'warn' : 'good'")
  })

  it('prioritizes alert status and routes the phone card into availability', () => {
    expect(source).toContain('const captainPhoneMatchCardRiskCount = workspaceState.responseAlertCount')
    expect(source).toContain("? `${captainPhoneMatchCardRiskCount} alert${captainPhoneMatchCardRiskCount === 1 ? '' : 's'}`")
    expect(source).toContain("workspaceState.responseAlertCount > 0 || workspaceState.pendingResponseCount > 0 ? availabilityHref : messagingHref")
    expect(source).toContain("{workspaceState.responseAlertCount > 0 ? 'Resolve alerts'")
  })
})
