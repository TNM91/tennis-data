import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const componentSource = readFileSync(join(process.cwd(), 'app/mylab/my-lab-command-center.tsx'), 'utf8')
const styleSource = readFileSync(join(process.cwd(), 'app/mylab/my-lab-command-center.module.css'), 'utf8')
const iconSource = readFileSync(join(process.cwd(), 'components/brand/TiqFeatureIcon.tsx'), 'utf8')
const portalSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const pricingSource = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const upgradeSource = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')

describe('My Lab command center', () => {
  it('puts one data-backed court action ahead of the legacy lab workspace', () => {
    const commandCenterIndex = pageSource.indexOf('<MyLabCommandCenter')
    const legacyWorkspaceIndex = pageSource.indexOf('<section id="player-workshop"')

    expect(commandCenterIndex).toBeGreaterThanOrEqual(0)
    expect(legacyWorkspaceIndex).toBeGreaterThan(commandCenterIndex)
    expect(pageSource).toContain('latestLevelUpProofCard?.title')
    expect(pageSource).toContain('latestLevelUpProofCard?.durationMinutes || 10')
    expect(pageSource).toContain("latestLevelUpProof ? 'Repeat this rep' : 'Start today\\'s rep'")
    expect(pageSource).toContain('completedSessions={commandCenterCompletedSessions}')
  })

  it('keeps player and opponent details navigable', () => {
    expect(componentSource).toContain('href={`/players/${encodeURIComponent(playerId)}`}')
    expect(componentSource).toContain('href={`/players/${encodeURIComponent(matchup.opponentId)}`}')
    expect(componentSource).toContain('href={matchup?.href || \'/matchup\'}')
    expect(componentSource).toContain('View matchup')
    expect(componentSource).toContain('See progress')
  })

  it('uses real TenAceIQ court assets and a mobile-safe hierarchy', () => {
    expect(componentSource).toContain('src="/tiq/courts/tiq-court-master.png"')
    expect(componentSource).toContain('src="/tiq/tokens/tennis-ball-reference.png"')
    expect(componentSource).toContain('sizes="(max-width: 760px) 100vw, 760px"')
    expect(styleSource).toContain('@media (max-width: 680px)')
    expect(styleSource).toContain('grid-template-columns: 1fr;')
    expect(styleSource).toContain('min-height: 58px;')
    expect(styleSource).toContain('overflow-wrap: anywhere;')
  })

  it('uses one signature My Lab mark across the workspace, navigation, and Player entry points', () => {
    expect(iconSource).toContain("signature = name === 'myLab'")
    expect(iconSource).toContain("'tiq-feature-icon--signature'")
    expect(iconSource).toContain('data-icon-treatment={signature ? \'signature\' : undefined}')
    expect(componentSource).toContain('<TiqFeatureIcon name="myLab" size="md" variant="surface" signature />')
    expect(componentSource).toContain('Player workspace')
    expect(portalSource).toContain("icon: 'myLab'")
    expect(pricingSource).toContain("player_plus: 'myLab'")
    expect(upgradeSource).toContain("player_plus: 'myLab'")
  })
})
