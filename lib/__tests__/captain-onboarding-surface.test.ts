import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}: CSSProperties = {`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain onboarding surface', () => {
  it('keeps the first Captain screen progressive and Data Assist aware', () => {
    expect(source).toContain('CAPTAIN_EMPTY_STATE_ACTIONS')
    expect(source).toContain('CaptainLockedSurface')
    expect(source).toContain('Team Hub preview')
    expect(source).toContain('Run the team week with more clarity.')
    expect(source).toContain('Preparing Team Hub')
    expect(source).toContain('League Office')
    expect(source).not.toContain('League Coordinator')
    expect(source).toContain('Compare plans')
    expect(source).toContain("if (!authResolved || role === 'public' || isMember(role))")
    expect(source).toContain('Set your player identity in My Lab so Captain can find your profile team.')
    expect(source).toContain('Upload a reviewed team summary or schedule through Data Assist')
    expect(source).toContain('Refresh Captain after the upload review connects teams, schedules, and scorecards.')
    expect(source).toContain('Need team history here?')
    expect(source).toContain('Captain needs a profile team, roster history, or reviewed Data Assist upload')
    expect(source).toContain("const dataAssistCaptainHref = '/data-assist?intent=upload-source&context=Team%20Hub'")
    expect(source).toContain('href={dataAssistCaptainHref}')
    expect(source).toContain('Set in My Lab')
    expect(source).toContain('Refresh with Data Assist')
    expect(source).toContain('Confirm availability, plan practice, build the lineup, and send the team plan from one lane.')
    expect(source).toContain('Plan practice')
    expect(source).toContain('Schedule practice, invite the roster, and collect In, Out, or Maybe responses in Messages.')
    expect(source).not.toContain("label: 'Read brief'")
    expect(source).not.toContain('Link your player identity in My Lab')
    expect(source).not.toContain('Link in My Lab')
    expect(source).not.toContain("if (role === 'public') return null")
  })

  it('keeps Captain onboarding compact on small mobile screens', () => {
    expect(styleBlock('pageWrap')).toContain("width: 'min(1280px, calc(100% - clamp(24px, 5vw, 48px)))'")
    expect(styleBlock('pageWrap')).toContain('overflowX: \'clip\'')
    expect(styleBlock('loadingWrap')).toContain("width: 'min(1280px, calc(100% - clamp(24px, 5vw, 48px)))'")
    expect(styleBlock('loadingWrap')).toContain('minWidth: 0')
    expect(styleBlock('heroCard')).toContain('minmax(0, 1.2fr)')
    expect(styleBlock('heroCard')).toContain('minmax(min(100%, 320px), 0.8fr)')
    expect(styleBlock('captainDataAssistCueStyle')).toContain('flexWrap: \'wrap\'')
    expect(styleBlock('captainPreviewGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'")
    expect(styleBlock('captainPreviewStepStyle')).toContain("gridTemplateColumns: 'minmax(0, 34px) minmax(0, 1fr)'")
    expect(styleBlock('captainPreviewStepStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("calc(100% - 48px)")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isMobile ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: 'auto minmax(0, 1fr)'")
  })

  it('keeps Captain empty states actionable for missing teams and rosters', () => {
    expect(source).toContain('Choose or connect a team scope.')
    expect(source).toContain('No roster players are available yet.')
    expect(source).toContain('Set profile')
    expect(source).toContain('Upload team data')
    expect(source).toContain('Open Data Assist')
    expect(source).toContain('Refresh Captain')
    expect(source).toContain('captainEmptyActionRowStyle')
    expect(source).toContain('inlineEmptyLinkStyle')
    expect(source).toContain('inlineEmptyButtonStyle')
  })
})
