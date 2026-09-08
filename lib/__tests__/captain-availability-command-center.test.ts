import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/captain/availability-requests/route.ts'), 'utf8')

describe('captain availability command center', () => {
  it('keeps the phone command surface compact and exposes the secure team link', () => {
    expect(page).toContain('Next match')
    expect(page).toContain('Link ready')
    expect(page).toContain('Change team or match')
    expect(page).toContain("copyAvailabilityLink(availabilityRequestUrl, 'Team link')")
    expect(page).toContain('Copy link')
    expect(page).toContain('new Date(`${match.match_date}T12:00:00`)')
  })

  it('gives every invited player a private share and preview action', () => {
    expect(page).toContain('playerRequestUrls')
    expect(page).toContain('Share private link')
    expect(page).toContain('Preview')
    expect(page).toContain('without joining TiQ')
  })

  it('persists captain-entered replies and allows a safe reset', () => {
    expect(page).toContain("method: 'PATCH'")
    expect(page).toContain("status === 'unanswered' ? undefined")
    expect(route).toContain('export async function PATCH(request: Request)')
    expect(route).toContain("if (status === 'unanswered')")
    expect(route).toContain(".from('captain_availability_request_responses')")
    expect(route).toContain("notes: 'Updated by captain'")
    expect(route).toContain(".from('lineup_availability')")
  })

  it('uses accessible pressed state for the captain reply controls', () => {
    expect(page).toContain('aria-pressed={player.status === \'in\'}')
    expect(page).toContain('aria-pressed={player.status === \'maybe\'}')
    expect(page).toContain('aria-pressed={player.status === \'out\'}')
    expect(page).toContain('role="status"')
  })
})
