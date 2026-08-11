import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
const globalStyles = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const playersSource = readFileSync(join(process.cwd(), 'app/players/page.tsx'), 'utf8')
const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')

describe('premium detail-page atmosphere', () => {
  it('labels the shared shell with stable visual area, mode, and surface hooks', () => {
    expect(shellSource).toContain('data-platform-area={visualArea}')
    expect(shellSource).toContain('data-platform-mode={visualMode}')
    expect(shellSource).toContain('data-platform-surface={visualSurface}')
    expect(shellSource).toContain('brand-atmosphere-mark--detail')
  })

  it('uses the approved full-resolution TenAceIQ court art for strategy detail pages', () => {
    expect(globalStyles).toContain("background-image: url('/tiq/courts/tiq-court-master.png')")
    expect(globalStyles).toContain('.brand-atmosphere-mark--detail.brand-atmosphere-mark--strategy')
    expect(globalStyles).toContain('-webkit-mask-image:')
  })

  it('replaces generic directory logo watermarks with tennis-specific approved artwork', () => {
    expect(playersSource).toContain('url("/player-profile/journey-hero.png")')
    expect(teamsSource).toContain('url("/player-profile/player-id-court.png")')
    expect(playersSource).not.toContain('url("/brand/web/header-iq-compact.png") center / contain no-repeat')
    expect(teamsSource).not.toContain('url("/brand/web/header-iq-compact.png") center / contain no-repeat')
  })
})
