import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    expect(source).toContain('Event-day alert command board')
    expect(source).toContain('Event-day alert settings')
    expect(source).toContain('Choose the texts that help you get to the next match.')
    expect(source).toContain('Tournament alerts are practical: court moves, schedule changes, result updates, and a clear way to stop messages.')
    expect(source).toContain('Know where to go next.')
    expect(source).toContain('Use this page to turn tournament texts on or off for this event only.')
    expect(source).toContain('alertCommandBoardStyle')
    expect(source).toContain('consentSteps')
    expect(source).toContain('Text alert consent checklist')
    expect(source).toContain('consentStepStyle')
    expect(source).toContain('readinessDotReadyStyle')
    expect(source).toContain('readinessDotWaitingStyle')
    expect(source).toContain('complianceNoteStyle')
    expect(source).toContain('Every text includes a TenAceIQ link and opt-out language. Reply STOP anytime.')
    expect(source).not.toContain('consentCardStyle')
  })

  it('keeps alert preference fields keyboard focus-visible', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain('const [focusedField, setFocusedField] = useState<string | null>(null)')
    expect(source).toContain("onFocus={() => setFocusedField('name')}")
    expect(source).toContain("onFocus={() => setFocusedField('phone')}")
    expect(source).toContain('const inputFocusStyle: CSSProperties')
    expect(styleBlock(source, 'inputStyle')).toContain("outline: '2px solid transparent'")
    expect(styleBlock(source, 'inputStyle')).toContain('outlineOffset: 2')
    expect(styleBlock(source, 'inputStyle')).not.toContain("outline: 'none'")
  })

  it('bridges tournament text alerts into Player ID follow-through before the form', () => {
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

    const checklistIndex = source.indexOf('aria-label="Text alert consent checklist"')
    const bridgeIndex = source.indexOf('aria-label="Tournament alerts Player ID follow-through"')
    const formIndex = source.indexOf('<form style={formStyle}')
    expect(checklistIndex).toBeGreaterThanOrEqual(0)
    expect(bridgeIndex).toBeGreaterThan(checklistIndex)
    expect(formIndex).toBeGreaterThan(bridgeIndex)
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
