import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')
const composerSource = readFileSync(join(process.cwd(), 'app/components/schedule-message-composer.tsx'), 'utf8')

function styleBlock(styleName: string, content = source) {
  const start = content.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = content.indexOf('\nconst ', start + 1)
  return content.slice(start, nextStyle === -1 ? undefined : nextStyle)
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
    expect(functionBlock('workspaceGridStyle')).toContain("gridTemplateColumns: isTablet")
    expect(functionBlock('workspaceGridStyle')).toContain("? 'minmax(0, 1fr)'")

    expect(styleBlock('pageStyle')).toContain('minWidth: 0')
    expect(styleBlock('panelStyle')).toContain('minWidth: 0')
    expect(functionBlock('workspaceGridStyle')).toContain('minWidth: 0')
  })

  it('keeps thread, alert, and message rows wrap-safe', () => {
    for (const styleName of [
      'sectionHeaderStyle',
      'identityRowStyle',
      'threadListStyle',
      'threadTopStyle',
      'emptyInboxStyle',
      'emptyInboxActionRowStyle',
      'emptyThreadStyle',
      'notificationListStyle',
      'notificationTopStyle',
      'messageListStyle',
      'contextPanelStyle',
      'opsPanelStyle',
      'schedulePanelStyle',
      'schedulePanelHeaderStyle',
      'segmentedStyle',
      'filterBarStyle',
      'fieldStyle',
      'inputStyle',
      'textareaStyle',
      'replyBoxStyle',
      'recipientResultsStyle',
      'primaryButtonStyle',
      'ghostButtonStyle',
      'coachContactsPanelStyle',
      'coachContactsGridStyle',
      'coachContactButtonStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'titleStyle',
      'sectionTitleStyle',
      'copyStyle',
      'identityRowStyle',
      'pillStyle',
      'unreadPillStyle',
      'threadPreviewStyle',
      'threadMetaStyle',
      'emptyInboxStyle',
      'emptyInboxActionStyle',
      'emptyThreadStyle',
      'labelStyle',
      'textareaStyle',
      'hintStyle',
      'successStyle',
      'errorStyle',
      'coachContactsTitleStyle',
      'coachContactButtonStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('threadTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('notificationTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('segmentedStyle')).toContain("repeat(auto-fit, minmax(min(100%, 120px), 1fr))")
    expect(styleBlock('pillStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('pillStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('unreadPillStyle')).toContain("whiteSpace: 'normal'")
    expect(source).toContain('Inbox starts when tennis needs a reply.')
    expect(source).toContain('Support, player notes, scheduling threads, and RSVP alerts will land here.')
    expect(source).toContain("title: 'Open My Lab'")
    expect(source).toContain("title: 'Improve data'")
    expect(source).toContain("title: 'Prep matchup'")
    expect(source).toContain('No thread selected.')
    expect(source).toContain('Start with the people tied to the work.')
    expect(source).toContain("setComposeContext({ entityType: 'coach_player_link', entityId: contact.linkId })")
    expect(source).toContain('assignmentTitle: searchParams.get')
    expect(source).toContain('Assignment follow-up:')
    expect(source).toContain("return contact?.relationship === 'student' ? '/coach' : '/mylab#player-workshop'")
    expect(source).toContain('fetchCoachMessageContacts')
    expect(styleBlock('coachContactsPanelStyle')).toContain("repeat(auto-fit, minmax(min(100%, 320px), 1fr))")
    expect(styleBlock('coachContactsGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 160px), 1fr))")
    expect(functionBlock('messageBubbleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('primaryButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButtonStyle')).toContain("whiteSpace: 'normal'")
  })

  it('keeps scheduling and recipient controls mobile-safe', () => {
    expect(functionBlock('rsvpSummaryStyle')).toContain("isMobile ? 'repeat(2, minmax(0, 1fr))'")
    expect(functionBlock('scheduleEditGridStyle')).toContain("isMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('lookupRowStyle')).toContain("isMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('lookupRowStyle')).toContain("'minmax(0, 1fr) minmax(0, auto)'")
    expect(functionBlock('lookupRowStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rsvpActionRowStyle')).toContain('minWidth: 0')
    expect(styleBlock('rsvpStatStyle')).toContain('minWidth: 0')
    expect(styleBlock('scheduleManagePanelStyle')).toContain('minWidth: 0')
    expect(styleBlock('cancelBoxStyle')).toContain('minWidth: 0')
    expect(styleBlock('schedulePillStackStyle')).toContain('minWidth: 0')
    expect(functionBlock('rsvpButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(functionBlock('rsvpButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('scheduleTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(functionBlock('filterButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(functionBlock('segmentStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('recipientResultButtonStyle')).toContain("flexWrap: 'wrap'")
    expect(source).toContain('style={lookupRowStyle(isMobile)}')
    expect(source).toContain('style={rsvpSummaryStyle(isMobile)}')
    expect(source).toContain('style={scheduleEditGridStyle(isMobile)}')
    expect(source).not.toContain("'minmax(0, 1fr) auto'")
    expect(styleBlock('fieldGridStyle', composerSource)).toContain("repeat(auto-fit, minmax(min(100%, 160px), 1fr))")
    expect(styleBlock('fieldGridStyle', composerSource)).toContain('minWidth: 0')
    expect(styleBlock('fieldStyle', composerSource)).toContain('minWidth: 0')
    expect(styleBlock('inputStyle', composerSource)).toContain('minWidth: 0')
    expect(styleBlock('targetStyle', composerSource)).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('recipientPreviewStyle', composerSource)).toContain("overflowWrap: 'anywhere'")
    expect(composerSource).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })
})
