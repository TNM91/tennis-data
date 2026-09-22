import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

describe('Captain match-week risk status', () => {
  it('does not label availability clean while a live risk needs attention', () => {
    expect(source).toContain("title: responseAlertCount > 0 ? 'Resolve match-week risk' : pendingCount > 0 ? 'Close the reply gap' : 'Availability is clean'")
    expect(source).toContain("cta: responseAlertCount > 0 ? 'Resolve alerts' : pendingCount > 0 ? 'Follow up' : 'Review'")
    expect(source).toContain("tone: responseAlertCount > 0 || pendingCount > 0 ? 'warn' : 'good'")
  })

  it('carries a live risk into the captain decision-path check', () => {
    expect(source).toContain('state: workspaceState.responseAlertCount > 0')
    expect(source).toContain("? 'Resolve late-arrival or substitution risk before you trust the weekly lineup.'")
    expect(source).toContain("tone: workspaceState.responseAlertCount > 0 || workspaceState.pendingResponseCount > 0 ? 'warn' : 'good'")
  })
})
