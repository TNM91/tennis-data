import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Team Room mobile composer', () => {
  const page = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'app/team-room/team-room.module.css'), 'utf8')

  it('keeps the captain availability action visible while folding optional message templates into a compact menu', () => {
    expect(page).toContain('aria-label="Quick team messages"')
    expect(page).toContain("{hasActiveAvailability ? 'Review availability' : 'Ask availability'}")
    expect(page).toContain('<Link className={styles.quickButton} href={practiceHref}>Plan practice</Link>')
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
    expect(page).toContain('rows={1}')
    expect(styles).toContain('.matchDayTravelActions')
    expect(styles).toContain('position: fixed;')
    expect(styles).toContain('height: min(58dvh, 620px);')
    expect(styles).toContain('overflow-y: auto;')
    expect(page).toContain("'--team-room-composer-inset': `${composerInset}px`")
    expect(page).toContain('ref={composerShellRef}')
    expect(styles).toContain('scroll-padding-bottom: var(--team-room-composer-inset, 224px);')
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) auto;')
    expect(styles).toContain('min-height: 44px;')
    expect(page).toContain('onClick={() => setReplyTo(null)}>Close</button>')
    expect(styles).toContain('white-space: nowrap;')
  })

  it('keeps the mobile opening chat-first and moves secondary room controls into one compact menu', () => {
    expect(page).toContain('className={styles.mobileRoomControls}')
    expect(page).toContain('className={styles.mobileRoomMenu}')
    expect(page).toContain('<summary>Team options</summary>')
    expect(page).toContain("room.teamLogoUrl ? 'Change logo' : 'Add team logo'")
    expect(styles).toContain('.mobileRoomMenuBody')
    expect(styles).toContain('.headerTop,')
    expect(styles).toContain('height: calc(100dvh - 112px);')
  })

  it('keeps Home Screen guidance compact in the chat header instead of below the conversation', () => {
    expect(page).toContain('<TeamRoomInstallHint />')
    expect(page).not.toContain('<TeamRoomInstallCard room={room} />')
    expect(page).toContain("{isStandalone ? 'Home Screen ready' : 'Add to Home Screen'}")
    expect(page).toContain("{installPrompt ? 'Add to Home Screen' : 'Show steps'}")
    expect(styles).toContain('.installHint')
    expect(styles).not.toContain('.installCard')
  })

  it('keeps the match plan in the message stream and makes it expandable', () => {
    expect(page).toContain('className={`${styles.matchPlanMessage}')
    expect(page).toContain('<small>Match plan</small>')
    expect(page).toContain('embedded')
    expect(page).toContain('open={expandedMatchPlanId === pinnedMessage.id}')
    expect(page).toContain("onToggle={(event) => setExpandedMatchPlanId(event.currentTarget.open ? pinnedMessage.id : '')}")
    expect(styles).toContain('.matchPlanMessage')
    expect(styles).toContain('.matchPlanMessage[open]')
    expect(styles).toContain('overflow-wrap: anywhere;')
    expect(page).toContain('open={defaultOpen ?? Boolean(result)}')
  })

  it('shows a team mark beside the approved iQ mark without exposing account roles', () => {
    expect(page).toContain('/brand/web/header-iq-compact.png')
    expect(page).toContain('room.teamLogoUrl')
    expect(page).toContain('/api/team-rooms/branding')
    expect(page).not.toContain('styles.roleBadge')
    expect(styles).toContain('.appTiqMark')
    expect(styles).toContain('.appTeamMark')
  })
})
