import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const myLab = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const club = readFileSync(join(process.cwd(), 'app/components/club-workspace.tsx'), 'utf8')
const normalizedMyLab = myLab.replace(/\r\n/g, '\n')

describe('launch entry clarity', () => {
  it('does not expose cached personal proof in the signed-out My Lab preview', () => {
    const guard = normalizedMyLab.indexOf('if (!accessPending && !userId && !canUseAdvancedPlayerInsights)')
    const mainWorkspace = normalizedMyLab.indexOf('return (\n    <section style={pageStyle}>', guard + 1)

    expect(guard).toBeGreaterThan(-1)
    expect(mainWorkspace).toBeGreaterThan(guard)
    expect(normalizedMyLab.slice(guard, mainWorkspace)).toContain('completedSessions={0}')
    expect(normalizedMyLab.slice(guard, mainWorkspace)).toContain('postRepReturn={null}')
    expect(normalizedMyLab.slice(guard, mainWorkspace)).toContain('repCta="Create free account"')
  })

  it('explains the Club value and product boundary before sign-in', () => {
    expect(club).toContain('without replacing your booking or registration system')
    expect(club).toContain('aria-label="Club experience preview"')
    expect(club).toContain('Players + staff')
    expect(club).toContain('Coaching + clinics')
    expect(club).toContain('Leagues + tournaments')
    expect(club).toContain('Your club experience')
  })
})
