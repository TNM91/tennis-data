import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')
const planCardSource = readFileSync(join(process.cwd(), 'app/profile/profile-plan-card.tsx'), 'utf8')
const planCardStyles = readFileSync(join(process.cwd(), 'app/profile/profile-plan-card.module.css'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Profile mobile layout guards', () => {
  it('keeps profile hero, setup, and form grids minmax-safe on mobile', () => {
    expect(source).not.toContain("? '1fr'")
    expect(source).not.toContain("whiteSpace: 'nowrap'")

    for (const styleName of [
      'profileIntroStyle',
      'contentGridStyle',
      'formGridStyle',
      'identityGridStyle',
      'autoContextStripStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minmax(0, 1fr)')
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
  })

  it('keeps profile shells, rows, and controls wrap-safe', () => {
    for (const styleName of [
      'pageStyle',
      'profileIntroStyle',
      'profileIntroCopyStyle',
      'profileIntroActionsStyle',
      'surfaceStyle',
      'sectionHeaderStyle',
      'autoContextStripStyle',
      'fieldStyle',
      'inputStyle',
      'actionRowStyle',
      'teamContextListStyle',
      'teamContextRowStyle',
      'ratingTileGridStyle',
      'ratingTileStyle',
      'profileAwardStripStyle',
      'profileAwardHeaderStyle',
      'profileAwardPillRowStyle',
      'profileAwardProofGridStyle',
      'profileAwardProofItemStyle',
      'newPlayerPathStyle',
      'newPlayerPathHeaderStyle',
      'newPlayerActionGridStyle',
      'newPlayerActionCardStyle',
      'profilePlayerIdStarterStyle',
      'profilePlayerIdStarterCopyStyle',
      'profilePlayerIdStarterGridStyle',
      'profilePlayerIdStarterItemStyle',
      'profilePlayerIdStarterActionRowStyle',
      'profileDetailsSummaryStyle',
      'profileEditorBodyStyle',
      'completedProfileSummaryStyle',
      'completedProfileStatusStyle',
      'completedProfileMetricGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'heroTitleStyle',
      'heroTextStyle',
      'primaryButtonStyle',
      'secondaryButtonStyle',
      'metricLabelStyle',
      'metricValueStyle',
      'profileLoadingNoticeStyle',
      'sectionTitleStyle',
      'sectionTextStyle',
      'labelStyle',
      'hintStyle',
      'teamContextRowStyle',
      'successStyle',
      'errorStyle',
      'profileAwardPillStyle',
      'profileAwardLinkStyle',
      'newPlayerPathStyle',
      'newPlayerPathHeaderStyle',
      'newPlayerActionCardStyle',
      'profilePlayerIdStarterStyle',
      'profilePlayerIdStarterCopyStyle',
      'profilePlayerIdStarterItemStyle',
      'profileDetailsCueStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(source).toContain('<details className="profileDetailsSection" style={playerIdPowersStyle}>')
    expect(globalsSource).toContain('.profileDetailsSection:not([open]) > :not(summary)')
    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamContextRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('profileIntroActionsStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('profileIntroStyle')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('watermarkStyle')).toContain('right: 0')
    expect(styleBlock('watermarkStyle')).not.toContain('right: \'clamp(-')
    expect(styleBlock('autoContextStripStyle')).toContain("gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('autoContextStripStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('ratingTileGridStyle')).toContain("gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('ratingTileGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('newPlayerActionGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('profilePlayerIdStarterGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('profilePlayerIdStarterActionRowStyle')).toContain("flexWrap: 'wrap'")
    for (const styleName of ['newPlayerPathHeaderStyle', 'newPlayerActionCardStyle']) {
      expect(styleBlock(styleName)).toContain("'minmax(0, auto) minmax(0, 1fr)'")
    }
    expect(source).not.toContain('minWidth: 96')
    expect(source).not.toContain("minWidth: 'min(100%, 96px)'")
    expect(source).not.toContain("'auto minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })

  it('keeps the active plan and secure Stripe handoff near the top on phones', () => {
    expect(source).toContain('<ProfilePlanCard')
    expect(source.indexOf('<ProfilePlanCard')).toBeLessThan(source.indexOf('id="profile-identity"'))
    expect(source).toContain("billingPlanStatus === 'past_due'")
    expect(source).toContain("billingPlanStatus === 'canceled'")
    expect(planCardSource).toContain('data-profile-plan-card="true"')
    expect(planCardSource).toContain('Billing details open securely in Stripe.')
    expect(planCardSource).toContain("tone === 'attention' && canManageBilling")
    expect(planCardSource).toContain('{destinationActionLabel}')
    expect(source).toContain("full_court: 'Player, coach, team, and league tools are unlocked.'")
    expect(source).toContain("access.role === 'captain'")
    expect(source).toContain("access.role === 'member'")
    expect(planCardStyles).toContain('min-height: 50px')
    expect(planCardStyles).toContain('.billingButton')
    expect(planCardStyles).toContain('min-height: 44px')
    expect(planCardStyles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(planCardStyles).toContain('@media (max-width: 719px)')
    expect(planCardStyles).toContain('gap: 8px')
    expect(planCardStyles).toContain('min-height: 48px')
    expect(planCardStyles).toContain('font-size: 9.5px')
    expect(planCardStyles).toContain('@media (max-width: 374px)')
  })

  it('removes repeated completed-profile hero actions only on phones', () => {
    expect(source).toContain(
      'const showProfileIntroActions = !isMobile || !profileComplete || captainSetupEntry || showScorecardClaimWelcome',
    )
    expect(source).toContain('{showProfileIntroActions ? (')
    expect(source).toContain('data-profile-intro-actions="true"')
    expect(source).toContain('Connect active team')
    expect(source).toContain('See your results')
    expect(source).toContain('Set profile')
    expect(source).toContain('Sign in')
  })

  it('collapses completed mobile player details into an accessible summary', () => {
    expect(source).toContain('const [profileEditorOpen, setProfileEditorOpen] = useState(false)')
    expect(source).toContain('const canUseCompactProfileSummary = Boolean(')
    expect(source).toContain('const showCompactProfileSummary = canUseCompactProfileSummary && !profileEditorOpen')
    expect(source).toContain('!captainSetupEntry')
    expect(source).toContain('!showScorecardClaimWelcome')
    expect(source).toContain('!justConnectedPlayer')
    expect(source).toContain('aria-label="Connected player summary"')
    expect(source).toContain('aria-controls="profile-identity-editor"')
    expect(source).toContain('id="profile-identity-editor"')
    expect(source).toContain('hidden={showCompactProfileSummary}')
    expect(source).toContain('Edit profile')
    expect(source).toContain('Close editor')
    expect(styleBlock('completedProfileEditButtonStyle')).toContain('minHeight: 44')
    expect(styleBlock('completedProfileMetricGridStyle')).toContain('repeat(auto-fit, minmax(min(100%, 84px), 1fr))')
  })
})
