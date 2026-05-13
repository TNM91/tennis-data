import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const upgradeSource = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')
const competeFrameSource = readFileSync(
  join(process.cwd(), 'app/compete/_components/compete-page-frame.tsx'),
  'utf8',
)

function styleBlock(source: string, styleName: string) {
  const pattern = new RegExp(`const ${styleName}: CSSProperties = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
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

    for (const styleName of ['primaryButtonStyle', 'valuePillStyle', 'activationStepStyle', 'handoffStepStyle']) {
      const block = styleBlock(upgradeSource, styleName)
      expect(block, styleName).toContain("overflowWrap: 'anywhere'")
      expect(block, styleName).toMatch(/maxWidth: '100%'|minWidth: 0/)
    }
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
      'workflowPulseCard',
      'workflowPulseLabel',
      'workflowPulseTitle',
      'workflowPulseText',
      'cardStyle',
      'cardMetaStyle',
      'cardTitleStyle',
      'cardTextStyle',
      'cardCtaStyle',
    ]) {
      const block = styleBlock(competeFrameSource, styleName)
      expect(block, styleName).toMatch(/minWidth: 0|overflowWrap: 'anywhere'/)
    }

    expect(competeFrameSource).toContain("<span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>")
  })
})
