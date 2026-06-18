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
      'threadHeaderActionStyle',
      'opsPanelStyle',
      'schedulePanelStyle',
      'schedulePanelHeaderStyle',
      'segmentedStyle',
      'filterBarStyle',
      'fieldStyle',
      'inputStyle',
      'textareaStyle',
      'replyBoxStyle',
      'replyBoxHeaderStyle',
      'quickReplyRowStyle',
      'quickReplyButtonStyle',
      'recipientResultsStyle',
      'primaryButtonStyle',
      'disabledPrimaryButtonStyle',
      'ghostButtonStyle',
      'triageSummaryStyle',
      'threadBadgeRowStyle',
      'composeReviewStyle',
      'composeReviewItemStyle',
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
      'draftPillStyle',
      'pinnedPillStyle',
      'threadTypePillStyle',
      'threadPreviewStyle',
      'threadMetaStyle',
      'emptyInboxStyle',
      'emptyInboxActionStyle',
      'emptyThreadStyle',
      'labelStyle',
      'supportStatusLineStyle',
      'quickReplyButtonStyle',
      'composeReviewItemStyle',
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
    expect(styleBlock('threadHeaderActionStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('threadBadgeRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('quickReplyRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('segmentedStyle')).toContain("repeat(auto-fit, minmax(min(100%, 120px), 1fr))")
    expect(styleBlock('pillStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('pillStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('unreadPillStyle')).toContain("whiteSpace: 'normal'")
    expect(source).toContain('Inbox starts when tennis needs a reply.')
    expect(source).toContain('Support requests, user replies, league rooms, and scheduling alerts will land here.')
    expect(source).toContain('Lineup notes, player replies, league messages, and schedule alerts will land here.')
    expect(source).toContain('Coach notes, support replies, schedule updates, and player messages will land here.')
    expect(source).toContain("type InboxFilter = 'all' | 'pinned' | 'needs_reply' | 'calendar' | 'unread' | 'support' | 'direct' | 'league' | 'schedule'")
    expect(source).toContain("type AlertFilter = 'all' | 'unread' | 'message' | 'support' | 'schedule' | 'system'")
    expect(source).toContain("if (filter === 'pinned') return 'Pinned'")
    expect(source).toContain("if (filter === 'calendar') return 'Calendar'")
    expect(source).toContain('alertFilterLabel')
    expect(source).toContain('notificationMatchesAlertFilter')
    expect(source).toContain('const [alertFilter, setAlertFilter] = useState')
    expect(source).toContain('const alertFilters = useMemo')
    expect(source).toContain('const filteredNotifications = useMemo')
    expect(source).toContain('filteredNotifications.map')
    expect(source).toContain('aria-pressed={alertFilter === filter.key}')
    expect(source).toContain('alertFilterLabel(notification.notificationType)')
    expect(source).toContain('No alerts match this filter.')
    expect(source).toContain('Show all alerts')
    expect(source).toContain('pinnedThreadsStorageKey')
    expect(source).toContain('readPinnedThreadIds')
    expect(source).toContain('writePinnedThreadIds')
    expect(source).toContain('const [pinnedThreadIds, setPinnedThreadIds] = useState')
    expect(source).toContain("filter === 'pinned'")
    expect(source).toContain('pinnedThreadIds.has(conversation.id)')
    expect(source).toContain('Pinned</small>')
    expect(source).toContain('toggleSelectedThreadPinned')
    expect(source).toContain('Thread pinned.')
    expect(source).toContain('Thread unpinned.')
    expect(source).toContain('pinnedCount ? <span>{pinnedCount} pinned</span>')
    expect(source).toContain('conversationMatchesInboxFilter')
    expect(source).toContain('conversationHasCalendarOpportunity')
    expect(source).toContain('conversationCalendarQuickAddCandidate')
    expect(source).toContain('Calendar cue</small>')
    expect(source).toContain('calendarPillStyle')
    expect(source).toContain('selectedThreadCalendarCue')
    expect(source).toContain('selectedThreadCalendarCueStyle')
    expect(source).toContain('calendarCueSummaryStyle')
    expect(source).toContain('selectedThreadCalendarCueActionStyle')
    expect(source).toContain('Show cue')
    expect(source).toContain('highlightedCalendarCueStyle')
    expect(source).toContain('tabIndex={-1}')
    expect(source).toContain('savedCalendarPillStyle')
    expect(source).toContain('conversationMatchesThreadSearch')
    expect(source).toContain('const [threadSearch, setThreadSearch] = useState')
    expect(source).toContain('Search threads')
    expect(source).toContain('Subject, message, status, league...')
    expect(source).toContain('Clear search')
    expect(source).toContain('Try a different search or clear filters to see the rest of your inbox.')
    expect(source).toContain('filteredConversations.length} shown')
    expect(source).toContain('replaceThreadUrl')
    expect(source).toContain('buildThreadShareUrl')
    expect(source).toContain("new URL('/messages', window.location.origin)")
    expect(source).toContain('copySelectedThreadLink')
    expect(source).toContain('navigator.clipboard.writeText')
    expect(source).toContain('Thread link copied.')
    expect(source).toContain('Thread link is ready in the address bar.')
    expect(source).toContain("url.searchParams.set('thread', conversationId)")
    expect(source).toContain("url.searchParams.delete('thread')")
    expect(source).toContain('selectConversation(conversation.id)')
    expect(source).toContain('No threads match these filters.')
    expect(source).toContain('Clear filters to see the rest of your inbox.')
    expect(source).toContain('Clear filters')
    expect(source).toContain('messageDraftStoragePrefix')
    expect(source).toContain('readMessageDraft')
    expect(source).toContain('writeMessageDraft')
    expect(source).toContain('removeMessageDraft')
    expect(source).toContain('getConversationDraftIds')
    expect(source).toContain('draftThreadIds.has(conversation.id)')
    expect(source).toContain('Draft</small>')
    expect(source).toContain('updateReplyDraft(event.target.value)')
    expect(source).toContain('onKeyDown={handleReplyKeyDown}')
    expect(source).toContain('Ctrl/Cmd Enter to send')
    expect(source).toContain('getQuickReplyActions')
    expect(source).toContain('insertQuickReply')
    expect(source).toContain('quickReplyActions.map')
    expect(source).toContain('Reviewing')
    expect(source).toContain('Need details')
    expect(source).toContain('Resolved note')
    expect(source).toContain('Time works')
    expect(source).toContain('Need alternate')
    expect(source).toContain('Lineup note')
    expect(source).toContain('Back to inbox')
    expect(source).toContain('Mark all read')
    expect(source).toContain('Copy link')
    expect(source).toContain("'Unpin' : 'Pin'")
    expect(source).toContain('Reply to this support request...')
    expect(source).toContain('Message this league room...')
    expect(source).toContain('Support reply')
    expect(source).toContain('const [recipientSearchRan, setRecipientSearchRan] = useState')
    expect(source).toContain('composeTargetLabel')
    expect(source).toContain('composeReadinessLabel')
    expect(source).toContain('canSubmitNewConversation')
    expect(source).toContain('Find player')
    expect(source).toContain('No TenAceIQ users matched that name or ID.')
    expect(source).toContain('Use Find player, then choose the right match before sending.')
    expect(source).toContain("event.key === 'Enter'")
    expect(source).toContain('body.trim().length} characters')
    expect(source).toContain('style={saving || !canSubmitNewConversation ? disabledPrimaryButtonStyle : primaryButtonStyle}')
    expect(source).toContain('Select a recipient')
    expect(styleBlock('composeReviewItemStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('disabledPrimaryButtonStyle')).toContain("cursor: 'not-allowed'")
    expect(styleBlock('replyBoxStyle')).toContain("position: 'sticky'")
    expect(source).toContain("const dataAssistMessagesHref = '/data-assist?intent=upload-source&context=Messages'")
    expect(source).toContain("title: 'Open My Lab'")
    expect(source).toContain("title: 'Fix tennis info'")
    expect(source).toContain("href: dataAssistMessagesHref")
    expect(source).toContain("title: 'Prep matchup'")
    expect(source).toContain('No thread selected.')
    expect(source).toContain('Start with the people tied to the work.')
    expect(source).toContain("setComposeContext({ entityType: 'coach_player_link', entityId: contact.linkId })")
    expect(source).toContain('assignmentTitle: searchParams.get')
    expect(source).toContain('Assignment follow-up:')
    expect(source).toContain('return `/coach${assignmentAnchor}`')
    expect(source).toContain("return assignmentAnchor ? `/mylab${assignmentAnchor}` : '/mylab#player-workshop'")
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
