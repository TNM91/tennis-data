import {describe,it,expect} from 'vitest'
import {replacementReminderIsCurrent,replacementReminderRequestId} from '../replacement-reminder-target'
import {parseReminderTargets} from '../team-room-match-flow'
const card={cardType:'projected_lineup',lineupChangedAt:'2026-10-24T10:00:00Z',lineupChangeNotice:{pending:false,response:'',publishedAnnouncementMessageId:'request-1',notifiedAt:'2026-10-24T10:00:00Z'}}
describe('scheduled replacement reminder identity',()=>{
 it('retains request bindings in stored targets and refuses a different request, answer or pending delivery',()=>{expect(parseReminderTargets([{profileId:'player',needsLineupChangeResponse:true,lineupChangeRequestId:' request-1 '}])[0].lineupChangeRequestId).toBe('request-1');expect(replacementReminderIsCurrent(card,'request-1','')).toBe(true);for(const patch of [{matchCompletedAt:'done'},{lineupChangeNotice:{...card.lineupChangeNotice,publishedAnnouncementMessageId:'request-2'}},{lineupChangeNotice:{...card.lineupChangeNotice,response:'accepted'}},{lineupChangeNotice:{...card.lineupChangeNotice,pending:true}}])expect(replacementReminderIsCurrent({...card,...patch},'request-1','')).toBe(false)})
 it('supports old timestamp-bound schedules only until a new court change and keeps the legacy request fallback',()=>{expect(replacementReminderIsCurrent(card,'','2026-10-24T11:00:00Z')).toBe(true);expect(replacementReminderIsCurrent(card,'','2026-10-24T09:00:00Z')).toBe(false);expect(replacementReminderIsCurrent(card,'','')).toBe(false);expect(replacementReminderRequestId({notifiedAt:'legacy'})).toBe('legacy')})
})
