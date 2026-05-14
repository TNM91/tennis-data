import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const tierPathwaySource = readFileSync(join(process.cwd(), 'app/components/tier-pathway.tsx'), 'utf8')
const upgradePromptSource = readFileSync(join(process.cwd(), 'app/components/upgrade-prompt.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('shared tier mobile layout guards', () => {
  it('keeps Tier Pathway shells, cards, and action rows mobile-safe', () => {
    for (const styleName of [
      'shellStyle',
      'unframedShellStyle',
      'headerStyle',
      'gridStyle',
      'compactGridStyle',
      'cardStyle',
      'cardTopStyle',
      'valueListStyle',
      'valueRowStyle',
      'ctaRowStyle',
      'stripStyle',
      'stripItemStyle',
      'upgradeStyle',
      'upgradeTopStyle',
    ]) {
      expect(styleBlock(tierPathwaySource, styleName), styleName).toContain('minWidth: 0')
    }

    for (const styleName of [
      'shellStyle',
      'badgeStyle',
      'titleStyle',
      'introStyle',
      'cardStyle',
      'cardTitleStyle',
      'cardTextStyle',
      'valueRowStyle',
      'ctaStyle',
      'stripItemStyle',
      'upgradeStyle',
      'upgradeTitleStyle',
      'upgradeTextStyle',
    ]) {
      expect(styleBlock(tierPathwaySource, styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock(tierPathwaySource, 'cardTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(tierPathwaySource, 'ctaStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(tierPathwaySource, 'ctaStyle')).toContain("maxWidth: '100%'")
  })

  it('keeps Upgrade Prompt tier cards and unlock paths mobile-safe', () => {
    for (const styleName of [
      'wrapStyle',
      'contentStyle',
      'labelRowStyle',
      'entitlementNoteStyle',
      'resultWrapStyle',
      'planMetaStyle',
      'valueListStyle',
      'unlockPathStyle',
      'unlockStepGridStyle',
      'unlockStepStyle',
      'unlockStepTextStyle',
      'actionRowStyle',
      'primaryActionStyle',
      'secondaryActionStyle',
    ]) {
      expect(styleBlock(upgradePromptSource, styleName), styleName).toContain('minWidth')
    }

    for (const styleName of [
      'wrapStyle',
      'eyebrowStyle',
      'badgeStyle',
      'titleStyle',
      'bodyStyle',
      'entitlementNoteStyle',
      'resultWrapStyle',
      'resultTextStyle',
      'valuePillStyle',
      'unlockPathStyle',
      'unlockStepTitleStyle',
      'unlockStepBodyStyle',
      'primaryActionStyle',
      'secondaryActionStyle',
      'errorTextStyle',
    ]) {
      expect(styleBlock(upgradePromptSource, styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock(upgradePromptSource, 'primaryActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(upgradePromptSource, 'secondaryActionStyle')).toContain("maxWidth: '100%'")
  })
})
