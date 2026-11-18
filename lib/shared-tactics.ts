import type { SupabaseClient } from '@supabase/supabase-js'
import { readTacticalBoard } from './native-tactics-contract'
import { readTacticalBoardReference, type TacticalBoardReference } from './tactical/board-reference'
import type { TacticalScenario } from './tactical/types'

export type SharedTacticsBoard = { reference: TacticalBoardReference; board: TacticalScenario }

export function readSharedTacticsBoard(value: unknown): SharedTacticsBoard {
  const row = value as Partial<SharedTacticsBoard> | null
  const reference = readTacticalBoardReference(row?.reference)
  const board = readTacticalBoard(row?.board)
  if (board.id !== reference.id) throw Error('The shared board does not match its saved version.')
  return { reference, board }
}

export async function loadSharedTacticsBoard(client: SupabaseClient, owner: string, reference: TacticalBoardReference) {
  const { data, error } = await client.from('tactical_scenarios').select('scenario_json')
    .eq('user_id', owner).eq('id', reference.id).eq('updated_at', reference.updatedAt)
    .abortSignal(AbortSignal.timeout(10000)).maybeSingle()
  if (error) throw Error('Could not load the saved tactics board.')
  if (!data) return null
  const board = readTacticalBoard(data.scenario_json)
  return readSharedTacticsBoard({
    reference,
    board: { ...board, note: '', cues: board.cues.filter(cue => cue.role === 'player') },
  })
}

export function assignmentBoardReference(assignment: Record<string, unknown>) {
  try { return readTacticalBoardReference(assignment.tactics) }
  catch { return null }
}

export function omitAssignmentBoard<T extends { assignment: Record<string, unknown> }>(record: T): T {
  if (!Object.hasOwn(record.assignment, 'tacticsBoard')) return record
  const assignment = { ...record.assignment }
  delete assignment.tacticsBoard
  return { ...record, assignment }
}
