import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const upgradeSource = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')
const lockedPlanSource = readFileSync(join(process.cwd(), 'app/components/locked-plan-page.tsx'), 'utf8')
const competeFrameSource = readFileSync(
  join(process.cwd(), 'app/compete/_components/compete-page-frame.tsx'),
  'utf8',
)
const competeLeaguesSource = readFileSync(join(process.cwd(), 'app/compete/leagues/page.tsx'), 'utf8')
const competeResultsSource = readFileSync(join(process.cwd(), 'app/compete/results/page.tsx'), 'utf8')
const competeScheduleSource = readFileSync(join(process.cwd(), 'app/compete/schedule/page.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('upgrade and compete mobile layout guards', () => {
  it('uses shrink-safe grid tracks for upgrade and compete hero collapses', () => {
    expect(upgradeSource).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(upgradeSource).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")

    expect(competeFrameSource).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(competeFrameSource).not.toContain("gridTemplateColumns: isMobile ? '1fr'")
    expect(competeFrameSource).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(competeFrameSource).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
  })

  it('keeps upgrade tier cards and activation flows shrinkable', () => {
    for (const styleName of [
      'pageStyle',
      'heroStyle',
      'heroCopyStyle',
      'planCardStyle',
      'resultCardStyle',
      'metaGridStyle',
      'activationStyle',
      'requestFormStyle',
      'successCardStyle',
    ]) {
      expect(styleBlock(upgradeSource, styleName), styleName).toContain('minWidth: 0')
    }
    expect(styleBlock(upgradeSource, 'pageStyle')).toContain(
      "width: 'min(1180px, calc(100% - clamp(24px, 5vw, 32px)))'",
    )
    expect(upgradeSource).not.toContain("calc(100% - 32px)")

    for (const styleName of ['primaryButtonStyle', 'valuePillStyle', 'activationStepStyle', 'handoffStepStyle']) {
      const block = styleBlock(upgradeSource, styleName)
      expect(block, styleName).toContain("overflowWrap: 'anywhere'")
      expect(block, styleName).toMatch(/maxWidth: '100%'|minWidth: 0/)
    }

    expect(styleBlock(upgradeSource, 'activationStepStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)'",
    )
    expect(styleBlock(upgradeSource, 'handoffStepStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)'",
    )
    expect(upgradeSource).not.toContain("gridTemplateColumns: '24px minmax(0, 1fr)'")
  })

  it('keeps shared locked plan gates shrink-safe', () => {
    expect(styleBlock(lockedPlanSource, 'pageWrapStyle')).toContain('minWidth: 0')
    expect(styleBlock(lockedPlanSource, 'pageWrapStyle')).toContain(
      "width: 'min(1180px, calc(100% - clamp(24px, 5vw, 32px)))'",
    )
    expect(lockedPlanSource).not.toContain("calc(100% - 32px)")
  })

  it('wraps long upgrade and compete product copy without forcing overflow', () => {
    for (const styleName of [
      'titleStyle',
      'textStyle',
      'planNameStyle',
      'priceStyle',
      'mutedStyle',
      'activationTitleStyle',
      'noteTextStyle',
      'successTitleStyle',
      'successMetaStyle',
    ]) {
      expect(styleBlock(upgradeSource, styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    for (const styleName of [
      'eyebrowChipStyle',
      'cardStyle',
      'cardMetaStyle',
      'cardTitleStyle',
      'cardQuestionStyle',
      'cardTextStyle',
      'cardCtaStyle',
    ]) {
      const block = styleBlock(competeFrameSource, styleName)
      expect(block, styleName).toMatch(/minWidth: 0|overflowWrap: 'anywhere'/)
    }

    expect(competeFrameSource).not.toContain('aria-label="Compete tools"')
    expect(competeFrameSource).not.toContain('function SubnavLink')
    expect(competeFrameSource).toContain("flexWrap: 'wrap'")
    expect(styleBlock(competeFrameSource, 'cardCtaStyle')).toContain("whiteSpace: 'normal'")
  })

  it('shows a shrink-safe captain bridge cue on Compete surfaces', () => {
    expect(competeFrameSource).toContain('aria-label="Captain match-week bridge cue"')
    expect(competeFrameSource).toContain('Captain match-week bridge')
    expect(competeFrameSource).toContain('Turn Compete context into Team Hub decisions.')
    expect(competeFrameSource).toContain('availability, lineup, scenario, and team message')
    expect(competeFrameSource).toContain("href: '/captain'")
    expect(competeFrameSource).toContain("href: '/captain/lineup-builder'")
    expect(competeFrameSource).toContain("href: '/captain/team-brief'")
    expect(competeFrameSource).toContain('CAPTAIN_HANDOFF_STEPS')
    expect(styleBlock(competeFrameSource, 'captainBridgeStyle')).toContain('minWidth: 0')
    expect(styleBlock(competeFrameSource, 'captainBridgeStepStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)'",
    )
    expect(styleBlock(competeFrameSource, 'captainBridgeStepStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(competeFrameSource, 'captainBridgeActionsStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(competeFrameSource, 'captainBridgeActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(competeFrameSource, 'captainBridgeActionStyle')).toContain("whiteSpace: 'normal'")
  })

  it('shows a shrink-safe Player ID match prep cue on Compete surfaces', () => {
    expect(competeFrameSource).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(competeFrameSource).toContain("const COMPETE_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')")
    expect(competeFrameSource).toContain('const COMPETE_LEVEL_UP_HREF = `/level-up/${COMPETE_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(competeFrameSource).toContain('const COMPETE_PLAYER_DEVELOPMENT_HREF = `/player-development/${COMPETE_PLAYER_IDENTITY.slug}`')
    expect(competeFrameSource).toContain('aria-label="Compete Player ID match prep"')
    expect(competeFrameSource).toContain('aria-label="Compete Player ID starter read"')
    expect(competeFrameSource).toContain('Compete from a clear player read.')
    expect(competeFrameSource).toContain('Start Level Up')
    expect(competeFrameSource).toContain('Read Player ID')
    expect(competeFrameSource.indexOf('Compete Player ID match prep')).toBeLessThan(
      competeFrameSource.indexOf('Captain match-week bridge cue'),
    )
    expect(styleBlock(competeFrameSource, 'competePlayerIdStyle')).toContain('minWidth: 0')
    expect(styleBlock(competeFrameSource, 'competePlayerIdReadStyle')).toContain('repeat(3, minmax(0, 1fr))')
    expect(styleBlock(competeFrameSource, 'competePlayerIdReadCardStyle')).toContain('minWidth: 0')
    expect(styleBlock(competeFrameSource, 'competePlayerIdActionsStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(competeFrameSource, 'competePlayerIdActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(competeFrameSource, 'competePlayerIdActionStyle')).toContain("whiteSpace: 'normal'")
  })

  it('keeps compete action rows and links shrink-safe', () => {
    for (const source of [competeLeaguesSource, competeResultsSource]) {
      expect(styleBlock(source, 'rowActionStackStyle')).toContain('minWidth: 0')
      expect(styleBlock(source, 'rowLinkStyle')).toContain("maxWidth: '100%'")
      expect(styleBlock(source, 'rowLinkStyle')).toContain("overflowWrap: 'anywhere'")
      expect(styleBlock(source, 'rowLinkStyle')).toContain("whiteSpace: 'normal'")
    }

    expect(styleBlock(competeLeaguesSource, 'sectionWrap')).toContain('repeat(auto-fit, minmax(min(100%, 280px), 1fr))')
    expect(styleBlock(competeLeaguesSource, 'sectionWrap')).toContain('minWidth: 0')
    expect(styleBlock(competeLeaguesSource, 'panelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(competeLeaguesSource, 'emptyLeagueStyle')).toContain('minWidth: 0')
    expect(styleBlock(competeLeaguesSource, 'emptyLeagueActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(competeLeaguesSource, 'emptyLeagueActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(competeLeaguesSource, 'emptyLeagueActionStyle')).toContain("whiteSpace: 'normal'")

    expect(styleBlock(competeScheduleSource, 'supportActionRowStyle')).toContain('minWidth: 0')
    expect(styleBlock(competeScheduleSource, 'prepActionRowStyle')).toContain('minWidth: 0')
    expect(styleBlock(competeScheduleSource, 'prepLinkStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(competeScheduleSource, 'prepLinkStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(competeScheduleSource, 'prepLinkStyle')).toContain("whiteSpace: 'normal'")
  })
})
