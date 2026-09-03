import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Team Room mobile composer', () => {
  const page = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'app/team-room/team-room.module.css'), 'utf8')

  it('keeps the captain availability action visible while folding optional message templates into a compact menu', () => {
    expect(page).toContain('aria-label="Quick team messages"')
    expect(page).toContain("{hasActiveAvailability ? 'Review availability' : 'Ask availability'}")
    expect(page).toContain('<details className={styles.quickMessageTemplates}>')
    expect(page).toContain('<summary className={styles.quickMessageTemplatesSummary}>')
    expect(page).toContain('Quick notes')
    expect(page).toContain('<div className={styles.quickMessageTemplatesBody}>')
    expect(page).toContain('QUICK_MESSAGES.map')
    expect(page).toContain("event.currentTarget.closest('details')?.removeAttribute('open')")
    expect(styles).toContain('.quickMessageTemplatesBody')
    expect(styles).toContain('bottom: calc(100% + 8px);')
    expect(styles).toContain('width: min(244px, calc(100vw - 40px));')
  })

  it('keeps the reply dock visible while messages scroll independently and groups travel actions', () => {
    expect(page).toContain('buildMatchWeekGoogleCalendarHref')
    expect(page).toContain('Add to calendar')
    expect(page).toContain('className={styles.matchDayTravelActions}')
    expect(page).toContain('aria-label="Team Chat message composer"')
    expect(page).toContain('Reply to the team')
    expect(styles).toContain('.matchDayTravelActions')
    expect(styles).toContain('position: fixed;')
    expect(styles).toContain('height: min(58dvh, 620px);')
    expect(styles).toContain('overflow-y: auto;')
    expect(styles).toContain('scroll-padding-bottom: 224px;')
  })

  it('keeps Home Screen guidance compact in the chat header instead of below the conversation', () => {
    expect(page).toContain('<TeamRoomInstallHint />')
    expect(page).not.toContain('<TeamRoomInstallCard room={room} />')
    expect(page).toContain("{isStandalone ? 'Home Screen ready' : 'Add to Home Screen'}")
    expect(page).toContain("{installPrompt ? 'Add to Home Screen' : 'Show steps'}")
    expect(styles).toContain('.installHint')
    expect(styles).not.toContain('.installCard')
  })
})
