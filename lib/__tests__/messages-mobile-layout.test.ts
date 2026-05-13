import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

function functionBlock(functionName: string) {
  const start = source.indexOf(`const ${functionName} =`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Messages mobile layout guards', () => {
  it('keeps hero and workspace grids from forcing tablet overflow', () => {
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('workspaceGridStyle')).toContain("? 'minmax(0, 1fr)'")

    expect(styleBlock('pageStyle')).toContain('minWidth: 0')
    expect(styleBlock('panelStyle')).toContain('minWidth: 0')
    expect(functionBlock('heroStyle')).toContain('minWidth: 0')
    expect(functionBlock('workspaceGridStyle')).toContain('minWidth: 0')
  })

  it('keeps thread, alert, and message rows wrap-safe', () => {
    for (const styleName of [
      'sectionHeaderStyle',
      'threadTopStyle',
      'notificationTopStyle',
      'messageListStyle',
      'segmentedStyle',
      'fieldStyle',
      'inputStyle',
      'recipientResultsStyle',
      'primaryButtonStyle',
      'ghostButtonStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('threadTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('notificationTopStyle')).toContain("flexWrap: 'wrap'")
    expect(functionBlock('messageBubbleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('primaryButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButtonStyle')).toContain("whiteSpace: 'normal'")
  })

  it('keeps scheduling and recipient controls mobile-safe', () => {
    expect(functionBlock('rsvpSummaryStyle')).toContain("isMobile ? 'repeat(2, minmax(0, 1fr))'")
    expect(functionBlock('scheduleEditGridStyle')).toContain("isMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('lookupRowStyle')).toContain("isMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('rsvpActionRowStyle')).toContain('minWidth: 0')
    expect(styleBlock('schedulePillStackStyle')).toContain('minWidth: 0')
    expect(styleBlock('recipientResultButtonStyle')).toContain("flexWrap: 'wrap'")
    expect(source).toContain('style={lookupRowStyle(isMobile)}')
    expect(source).toContain('style={rsvpSummaryStyle(isMobile)}')
    expect(source).toContain('style={scheduleEditGridStyle(isMobile)}')
  })
})
