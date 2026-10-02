import { describe, it, expect } from 'vitest'
import { conflictsWithTennisRecordSourceIdentity } from '../tennisrecord/source-player-link'
describe('same-name TR source linkage', () => {
  it('rejects a different source profile even when the local name is unique', () => {
    expect(conflictsWithTennisRecordSourceIdentity({ external_source: 'tennisrecord', external_source_key: 'profile-virginia' }, 'profile-missouri')).toBe(true)
  })
  it('retains exact source links', () => {
    expect(conflictsWithTennisRecordSourceIdentity({ external_source: 'tennisrecord', external_source_key: 'profile-missouri' }, 'profile-missouri')).toBe(false)
  })
  it('does not invent a TR conflict for a player without a TR source identity', () => {
    expect(conflictsWithTennisRecordSourceIdentity({ external_source: null, external_source_key: null }, 'profile')).toBe(false)
    expect(conflictsWithTennisRecordSourceIdentity({ external_source: 'usta', external_source_key: 'official' }, 'profile')).toBe(false)
  })
})
