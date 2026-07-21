import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const portalSource = readFileSync(join(process.cwd(), 'app/player-development/_components/level-up-portal.tsx'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8')

describe('Player Development Level Up mobile layout', () => {
  it('keeps the phone-first portal focused before the full library', () => {
    expect(portalSource.indexOf('<LevelUpOnCourtCommand')).toBeLessThan(portalSource.indexOf('<LevelUpStartList'))
    expect(portalSource.indexOf('<LevelUpStartList')).toBeLessThan(portalSource.indexOf('<LevelUpSmartRail title="Coach Assigned"'))
    expect(portalSource).toContain('You do not need to browse the whole library first.')
  })

  it('uses compact phone-only rails and summaries for the portal', () => {
    expect(stylesSource).toContain('.levelUpStartList .levelUpRailGrid {\n    display: flex;')
    expect(stylesSource).toContain('scrollbar-color: rgba(155, 225, 29, 0.72) rgba(255, 255, 255, 0.12);')
    expect(stylesSource).toContain('.levelUpStartList .levelUpRailGrid::-webkit-scrollbar')
    expect(stylesSource).toContain('.levelUpStartList .levelUpRailGrid article,\n  .levelUpStartList .levelUpRailGrid article[data-activity=\'true\']')
    expect(stylesSource).toContain('flex: 0 0 min(82vw, 306px);')
    expect(stylesSource).toContain('.levelUpLocalSyncProof p:nth-child(n+2) {\n    display: none;')
    expect(portalSource).toContain('className={styles.levelUpLibraryDrawer}')
    expect(portalSource).toContain('className={styles.levelUpLibraryDrawerSummary}')
    expect(portalSource).toContain('Open training rails, modules, and all cards.')
    expect(stylesSource).toContain('.levelUpLibraryDrawer:not([open]) > .levelUpLibraryDrawerBody {\n  display: contents;')
    expect(stylesSource).toContain('.levelUpLibraryDrawer:not([open]) > .levelUpLibraryDrawerBody {\n    display: none;')
    expect(stylesSource).toContain(".levelUpPortalApp[data-session-focus='active'] .levelUpLibraryDrawer")
    expect(stylesSource).toContain(".levelUpFocusTraining:not([open]) .levelUpRailSummary::after")
    expect(stylesSource).toContain('.levelUpFocusTraining:not([open]) .levelUpRailSummary strong {\n    display: none;')
    expect(stylesSource).toContain('.levelUpRail:not([open]) .levelUpRailSummary span {\n    display: none;')
  })
})
