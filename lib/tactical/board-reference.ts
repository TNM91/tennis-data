export type TacticalBoardReference = { id: string; updatedAt: string }

export function readTacticalBoardReference(value: unknown): TacticalBoardReference {
  const row = value as Partial<TacticalBoardReference> | null
  if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(row.id) ||
      typeof row.updatedAt !== 'string' || row.updatedAt.length > 80 || !Number.isFinite(Date.parse(row.updatedAt))) {
    throw Error('Choose a saved tactics board.')
  }
  return { id: row.id, updatedAt: row.updatedAt }
}

export function sameTacticalBoardReference(a: TacticalBoardReference | null, b: TacticalBoardReference | null) {
  return a?.id === b?.id && a?.updatedAt === b?.updatedAt
}
