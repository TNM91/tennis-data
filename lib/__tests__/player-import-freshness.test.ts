import { describe, expect, it } from 'vitest'
import { summarizePlayerImportFreshness } from '../player-import-freshness'
const now = new Date('2026-10-04T12:00:00Z')
const done = { status:'done', current_refreshed_at:'2026-10-03T12:00:00Z', refresh_due_at:'2026-10-10T12:00:00Z' }
describe('player import freshness',()=>{
 it('uses the oldest covered history, not the newest capture',()=>{expect(summarizePlayerImportFreshness([done,{...done,current_refreshed_at:'2026-10-04T11:00:00Z'}],2,now)).toMatchObject({status:'current',lastImportedAt:done.current_refreshed_at})})
 it('does not claim complete coverage when a season is missing',()=>{expect(summarizePlayerImportFreshness([done],2,now)).toMatchObject({status:'pending',lastImportedAt:null})})
 it('flags due history even if its previous capture succeeded',()=>{expect(summarizePlayerImportFreshness([{...done,refresh_due_at:'2026-10-04T11:00:00Z'}],1,now).status).toBe('overdue')})
 it('keeps review separate from pending requests',()=>{expect(summarizePlayerImportFreshness([{...done,status:'review'}],1,now)).toMatchObject({status:'review',reviewPages:1,pendingPages:0})})
 it('rejects invalid capture dates as evidence',()=>{expect(summarizePlayerImportFreshness([{...done,current_refreshed_at:'invalid'}],1,now)).toMatchObject({status:'pending',lastImportedAt:null})})
})
