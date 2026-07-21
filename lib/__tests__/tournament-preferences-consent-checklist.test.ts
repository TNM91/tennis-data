import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('tournament preferences consent checklist', () => {
  it('shows compact consent readiness before saving text preferences', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain('alertCommandItems')
    expect(source).toContain("import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'")
    expect(source).toContain('const { isMobile } = useViewportBreakpoints()')
    expect(source).toContain('Event-day alert command board')
    expect(source).toContain('Event-day alert settings')
    expect(source).toContain('Choose the texts that help you get to the next match.')
    expect(source).toContain('Tournament alerts are practical: court moves, schedule changes, result updates, and a clear way to stop messages.')
    expect(source).toContain('Know where to go next.')
    expect(source).toContain('Turn tournament texts on or off for this event only.')
    expect(source).toContain('alertCommandBoardStyle')
    expect(source).toContain('alertDetailsSectionStyle')
    expect(source).toContain('className="tournamentAlertDetailsSection"')
    expect(globalsSource).toContain('.tournamentAlertDetailsSection:not([open]) > :not(summary)')
    expect(source).toContain('Show alert types')
    expect(source).toContain("isMobile ? 'Text alerts for match day.' : 'Choose the texts that help you get to the next match.'")
    expect(source).toContain("isMobile ? 'Player ID after alerts.' : 'Texts tell you what changed. Player ID tells you what to train next.'")
    expect(source).toContain("display: isMobile ? 'none' : undefined")
    expect(source).toContain('consentSteps')
    expect(source).toContain('Text alert consent checklist')
    expect(source).toContain('consentStepStyle')
    expect(source).toContain('readinessDotReadyStyle')
    expect(source).toContain('readinessDotWaitingStyle')
    expect(source).toContain('complianceNoteStyle')
    expect(source).toContain('Every text includes a TenAceIQ link and opt-out language. Reply STOP anytime.')
    expect(source).not.toContain('consentCardStyle')
    expect(styleBlock(source, 'compactAlertDetailsSummaryStyle')).toContain("padding: '9px 10px'")
    expect(styleBlock(source, 'compactAlertDetailsTitleStyle')).toContain('fontSize: 13')
    expect(styleBlock(source, 'compactConsentStepStyle')).toContain('gridTemplateColumns')

    const checklistIndex = source.indexOf('aria-label="Text alert consent checklist"')
    const formIndex = source.indexOf('<form style={{ ...formStyle')
    const alertTypesIndex = source.indexOf('aria-label="Event-day alert command board"')
    expect(checklistIndex).toBeGreaterThanOrEqual(0)
    expect(formIndex).toBeGreaterThan(checklistIndex)
    expect(alertTypesIndex).toBeGreaterThan(formIndex)
  })

  it('keeps alert preference fields keyboard focus-visible', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain('const [focusedField, setFocusedField] = useState<string | null>(null)')
    expect(source).toContain("onFocus={() => setFocusedField('name')}")
    expect(source).toContain("onFocus={() => setFocusedField('phone')}")
    expect(source).toContain('const inputFocusStyle: CSSProperties')
    expect(source).toContain('compactInputStyle')
    expect(styleBlock(source, 'inputStyle')).toContain("outline: '2px solid transparent'")
    expect(styleBlock(source, 'inputStyle')).toContain('outlineOffset: 2')
    expect(styleBlock(source, 'inputStyle')).not.toContain("outline: 'none'")
    expect(styleBlock(source, 'compactInputStyle')).toContain('minHeight: 42')
    expect(styleBlock(source, 'compactButtonStyle')).toContain('minHeight: 40')
  })

  it('keeps Player ID follow-through available after the text preference form', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain("getPlayerDevelopmentIdentity('pressure-closer-4-0')")
    expect(source).toContain('TOURNAMENT_ALERT_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TOURNAMENT_ALERT_PLAYER_IDENTITY)')
    expect(source).toContain('TOURNAMENT_ALERT_LEVEL_UP_HREF')
    expect(source).toContain('const TOURNAMENT_ALERT_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_ALERT_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(source).toContain('TOURNAMENT_ALERT_PLAYER_DEVELOPMENT_HREF')
    expect(source).toContain('aria-label="Tournament alerts Player ID follow-through"')
    expect(source).toContain('aria-label="Tournament alerts Player ID starter read"')
    expect(source).toContain('Alerts to Player ID')
    expect(source).toContain('Texts tell you what changed. Player ID tells you what to train next.')
    expect(source).toContain('After court alerts or results land, keep one pressure cue ready.')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('Prep matchup')
    expect(source).toContain('Show Player ID prep')

    const bridgeIndex = source.indexOf('aria-label="Tournament alerts Player ID follow-through"')
    const formIndex = source.indexOf('<form style={{ ...formStyle')
    expect(bridgeIndex).toBeGreaterThan(formIndex)
  })

  it('keeps the Player ID alert bridge from squeezing on phone screens', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    const commandStyle = styleBlock(source, 'alertCommandBoardStyle')
    expect(commandStyle).toContain("gridTemplateColumns: '1fr'")
    expect(commandStyle).toContain('minWidth: 0')
    expect(commandStyle).toContain("overflow: 'hidden'")

    const commandGridStyle = styleBlock(source, 'alertCommandGridStyle')
    expect(commandGridStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 128px), 1fr))'")
    expect(commandGridStyle).toContain('minWidth: 0')

    const bridgeStyle = styleBlock(source, 'alertPlayerIdStyle')
    expect(bridgeStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'")
    expect(bridgeStyle).toContain('minWidth: 0')
    expect(bridgeStyle).toContain("overflowWrap: 'anywhere'")

    const signalGridStyle = styleBlock(source, 'alertPlayerIdSignalGridStyle')
    expect(signalGridStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))'")
    expect(signalGridStyle).toContain('minWidth: 0')

    const actionRowStyle = styleBlock(source, 'alertPlayerIdActionRowStyle')
    expect(actionRowStyle).toContain("flexWrap: 'wrap'")

    const actionStyle = styleBlock(source, 'alertPlayerIdActionStyle')
    expect(actionStyle).toContain("maxWidth: '100%'")
    expect(actionStyle).toContain("whiteSpace: 'normal'")
    expect(actionStyle).toContain("overflowWrap: 'anywhere'")
  })
})
