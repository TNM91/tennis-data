import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8').replaceAll('\r\n', '\n')
}

describe('Captain projected lineup confirmation flow', () => {
  it('saves the exact potential lineup before opening availability messaging', () => {
    const source = readSource('app/captain/lineup-builder/page.tsx')

    expect(source).toContain('async function confirmPotentialLineupAvailability()')
    expect(source).toContain('const savedScenario = await saveScenario(false, true)')
    expect(source).toContain('Potential lineup - ${formatDate(matchDate || null)}')
    expect(source).toContain("window.localStorage.setItem(CAPTAIN_LINEUP_HANDOFF_STORAGE_KEY")
    expect(source).toContain("'Confirm availability'")
  })

  it('opens messaging as an availability request rather than a final lineup announcement', () => {
    const source = readSource('app/captain/messaging/page.tsx')

    expect(source).toContain("setMessageTitle('Potential lineup availability')")
    expect(source).toContain('buildPotentialLineupAvailabilityMessage({')
    expect(source).toContain('Open availability texts')
    expect(source).toContain('Record ${contact.full_name}\'s reply')
  })

  it('lets invited players answer future match dates without signing in', () => {
    const page = readSource('app/availability/[token]/availability-response-client.tsx')
    const route = readSource('app/api/captain/availability-requests/[token]/route.ts')

    expect(page).toContain('Set your availability')
    expect(page).toContain("fetch(`/api/captain/availability-requests/${encodeURIComponent(token)}`")
    expect(page).toContain('Want fewer availability texts?')
    expect(page).not.toContain('useAuth')
    expect(route).toContain("captain_availability_request_responses")
    expect(route).toContain(".from('lineup_availability')")
  })
})
