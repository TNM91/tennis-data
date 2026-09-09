import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8').replace(/\r\n/g, '\n')

describe('Captain lineup builder save and insights flow', () => {
  it('keeps background text preparation from presenting an Ask message', () => {
    expect(source).toContain('if (!options.silent) {\n      setAskingCourtId(slot.id)')
    expect(source).toContain('if (!options.silent) {\n        setError(caught instanceof Error')
    expect(source).not.toContain('is ready. Tap Ask')
    expect(source).not.toContain('Preparing a private availability text')
  })

  it('makes saving an intentional first action and keeps optional analysis collapsed on phones', () => {
    expect(source).toContain('Draft autosaved to TiQ')
    expect(source).toContain("currentScenarioId ? 'Update saved version' : 'Save lineup version'")
    expect(source).toContain('Your working lineup saves automatically. Save a version when you want a stable checkpoint to compare, send, print, or track replies.')
    expect(source).toContain('Scorecard, strategy, and next steps')
    expect(source).toContain('open={isMobile ? mobileForecastOpen : true}')
    expect(source).toContain('id="captain-lineup-match-forecast"')
    expect(source).toContain('Build a recommended draft')
    expect(source).toContain('Opponent lineup projected.')
    expect(source).toContain('View matchup forecast')
    expect(source).toContain('{!isMobile ? <details style={surfaceCardStrong}>')
  })

  it('explains captain-recorded Yes replies and makes the final send, image, and scorecard handoff explicit', () => {
    expect(source).toContain("label: 'Yes confirmed'")
    expect(source).toContain('They replied Yes, or you recorded their Yes from a text or call.')
    expect(source).toContain("setMessage('Yes recorded and this player is protected in the lineup.')")
    expect(source).toContain("const finalLineupSent = lineupDeliveryReceipt?.kind === 'final'")
    expect(source).toContain(": finalLineupSent ? 'Sent to Team Chat' : 'Send lineup to Team Chat'")
    expect(source).toContain("action: 'post_match_card'")
    expect(source).toContain("action: 'send_final_lineup'")
    expect(source).toContain('captainConfirmedLineup: true')
    expect(source).toContain("hrefUrl.searchParams.set('message', result.messageId)")
    expect(source).toContain('Post the confirmed lineup without leaving this page, then share the image or print the scorecard.')
    expect(source).toContain("setMessage('Final lineup posted to Team Chat.')")
    expect(source).toContain('Create image + text team')
    expect(source).toContain('Copy lineup text')
    expect(source).toContain('Mark Yes & lock')
  })
})
