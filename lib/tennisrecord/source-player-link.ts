/** An existing TR source identity cannot be replaced by a same-name profile. */
export function conflictsWithTennisRecordSourceIdentity(existing: { external_source?: string | null; external_source_key?: string | null }, incomingSourceKey: string) {
  return existing.external_source === 'tennisrecord' && Boolean(existing.external_source_key) && existing.external_source_key !== incomingSourceKey
}
