import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const portalSource = readFileSync(join(process.cwd(), 'app/player-development/_components/level-up-portal.tsx'), 'utf8')
const levelUpPageSource = readFileSync(join(process.cwd(), 'app/level-up/level-up-page-content.tsx'), 'utf8')
const identitySelectorSource = readFileSync(join(process.cwd(), 'app/level-up/player-identity-selector.tsx'), 'utf8')
const liveWorkbenchSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8').replace(/\r\n/g, '\n')

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

  it('keeps Level Up focus choices readable in a two-column phone grid', () => {
    expect(stylesSource).toContain('.liveFocusRail {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));')
    const narrowPhoneRules = stylesSource.slice(stylesSource.indexOf('@media (max-width: 620px)'))
    expect(narrowPhoneRules).not.toContain('.liveFocusRail,\n  .liveContextGrid')
    expect(stylesSource).toContain('.liveFocusButton strong {\n    overflow-wrap: normal;\n    word-break: normal;')
    expect(stylesSource).toContain('.levelUpToolboxBody,\n  .levelUpToolboxLinks {\n    grid-template-columns: 1fr;')
  })

  it('puts Player ID drill recommendations before the live workbench and removes mobile library overflow', () => {
    expect(levelUpPageSource.indexOf('levelUpIdentityDrillGuide')).toBeLessThan(levelUpPageSource.indexOf('<PlayerLiveWorkbench'))
    expect(levelUpPageSource).toContain('Playing style profile')
    expect(levelUpPageSource).toContain('Start best-fit drill')
    expect(levelUpPageSource).toContain('Find another path')
    expect(levelUpPageSource).toContain('const quickStartCards = recommendedCards.slice(0, 3)')
    expect(stylesSource).toContain('.levelUpCardRail,\n  .levelUpModuleRail {\n    display: grid;')
    expect(stylesSource).toContain('.levelUpLibraryGrid {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(identitySelectorSource).toContain('Compare or update')
    expect(identitySelectorSource).toContain('Style stays steady. Focus can change.')
    expect(stylesSource).toContain('.levelUpIdentityChoiceGrid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(stylesSource).toContain('.levelUpIdentityCurrentCopy p {\n    display: none;')
  })

  it('scrolls directly to the choice flow when Focus, Work, or Setup is opened', () => {
    expect(liveWorkbenchSource).toContain('const trainingFlowRef = useRef<HTMLDivElement | null>(null)')
    expect(liveWorkbenchSource).toContain('function openEditingStep(step: Exclude<EditingStep, null>)')
    expect(liveWorkbenchSource).toContain("trainingFlowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })")
    expect(liveWorkbenchSource).toContain("onClick={() => openEditingStep('focus')}")
    expect(liveWorkbenchSource).toContain('ref={trainingFlowRef} className={styles.liveTrainingFlow}')
  })
})
