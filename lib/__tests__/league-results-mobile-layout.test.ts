import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamSource = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')
const individualSource = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('League result workspace mobile layout guards', () => {
  it('keeps team result entry forms and scorekeeper cards mobile-safe', () => {
    expect(teamSource).toContain("import { AuthProvider, useAuth } from '@/app/components/auth-provider'")
    expect(teamSource).toContain('const { role, userId, entitlements, authResolved } = useAuth()')
    expect(teamSource).toContain('if (!authResolved)')
    expect(teamSource).toContain('buildProductAccessState(role, entitlements)')
    expect(teamSource).not.toContain('getClientAuthState')
    for (const styleName of [
      'pageWrap',
      'introCard',
      'card',
      'row',
      'fieldWrap',
      'inputStyle',
      'lineGrid',
      'lineCard',
      'eventHeaderCopy',
      'lineHeaderRow',
      'lineTypeRow',
      'scorekeeperGrid',
      'scorekeeperTile',
      'detailsCard',
      'detailsSummary',
      'resultPathCommandStyle',
      'resultPathStatusPanelStyle',
      'resultPathStatusGridStyle',
      'resultPathStatusItemStyle',
      'emptyResultPanel',
      'emptyResultCopy',
      'emptyResultActions',
    ]) {
      expect(styleBlock(teamSource, styleName)).toContain('minWidth: 0')
    }

    expect(teamSource).toContain('<div style={eventHeaderCopy}>')
    expect(teamSource).toContain('<div style={eventTitleText}>')
    expect(teamSource).toContain('<div style={eventMetaText}>')
    expect(teamSource).toContain('<div style={lineHeaderRow}>')
    expect(teamSource).toContain('<div style={linePlayerText}>')
    expect(teamSource).toContain('<div style={lineScoreText}>{line.score}</div>')
    expect(styleBlock(teamSource, 'eventHeaderCopy')).toContain("maxWidth: '100%'")
    expect(styleBlock(teamSource, 'eventTitleText')).toContain("maxWidth: '100%'")
    expect(styleBlock(teamSource, 'eventMetaText')).toContain("maxWidth: '100%'")
    expect(styleBlock(teamSource, 'linePlayerText')).toContain("maxWidth: '100%'")
    expect(styleBlock(teamSource, 'lineScoreText')).toContain("maxWidth: '100%'")
    expect(styleBlock(teamSource, 'btnPrimary')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'btnPrimary')).toContain("color: 'var(--foreground-strong)'")
    expect(styleBlock(teamSource, 'btnPrimary')).toContain('color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)')
    expect(styleBlock(teamSource, 'lineCard')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'scorekeeperTile')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'resultPathCommandStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))'")
    expect(styleBlock(teamSource, 'resultPathGrid')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))'")
    expect(styleBlock(teamSource, 'resultPathStatusGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))'")
    expect(styleBlock(teamSource, 'resultPathStatusItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'pill')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(teamSource, 'emptyResultActions')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(teamSource, 'emptyResultAction')).toContain("maxWidth: '100%'")
    expect(styleBlock(teamSource, 'emptyResultAction')).toContain("whiteSpace: 'normal'")
    expect(teamSource).toContain("gap: 8, marginTop: 8, flexWrap: 'wrap', minWidth: 0")
    expect(teamSource).not.toContain("color: '#0a0a0a'")
  })

  it('keeps individual result forms, standings, and review cards mobile-safe', () => {
    expect(individualSource).toContain("import { AuthProvider, useAuth } from '@/app/components/auth-provider'")
    expect(individualSource).toContain('const { role, userId, entitlements, authResolved } = useAuth()')
    expect(individualSource).toContain('if (!authResolved)')
    expect(individualSource).toContain('buildProductAccessState(role, entitlements)')
    expect(individualSource).not.toContain('getClientAuthState')
    for (const styleName of [
      'pageWrap',
      'introCard',
      'card',
      'detailsCard',
      'detailsSummary',
      'row',
      'fieldWrap',
      'inputStyle',
      'scorekeeperGrid',
      'scorekeeperTile',
      'resultPathCommandStyle',
      'resultPathStatusPanelStyle',
      'resultPathStatusGridStyle',
      'resultPathStatusItemStyle',
      'listWrap',
      'resultCard',
      'actionRow',
      'insightGrid',
      'standingsList',
      'standingRow',
      'standingCopy',
      'metricStack',
      'emptyResultPanel',
      'emptyResultCopy',
      'emptyResultActions',
      'reviewPanelStyle',
      'reviewCommandGridStyle',
      'reviewFilterGridStyle',
      'reviewActionRowStyle',
    ]) {
      expect(styleBlock(individualSource, styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock(individualSource, 'standingRow')).toContain("'minmax(0, 32px) minmax(0, 1fr) minmax(0, auto)'")
    expect(styleBlock(individualSource, 'standingRow')).toContain("overflowWrap: 'anywhere'")
    expect(individualSource).toContain('<div style={standingCopy}>')
    expect(styleBlock(individualSource, 'standingCopy')).toContain("maxWidth: '100%'")
    expect(styleBlock(individualSource, 'btnPrimary')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'btnPrimary')).toContain("color: 'var(--foreground-strong)'")
    expect(styleBlock(individualSource, 'scorekeeperTile')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'resultPathCommandStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))'")
    expect(styleBlock(individualSource, 'resultPathGrid')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))'")
    expect(styleBlock(individualSource, 'resultPathStatusGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))'")
    expect(styleBlock(individualSource, 'resultPathStatusItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'btnSecondary')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(individualSource, 'resultCard')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'resultTitle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'metricStack')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'emptyResultActions')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(individualSource, 'emptyResultAction')).toContain("maxWidth: '100%'")
    expect(styleBlock(individualSource, 'emptyResultAction')).toContain("whiteSpace: 'normal'")
    expect(individualSource).not.toContain("'32px minmax(0, 1fr) auto'")
    expect(individualSource).not.toContain("gridTemplateColumns: '32px minmax(0, 1fr)'")
    expect(individualSource).not.toContain("color: '#0a0a0a'")
  })
})
