import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LEVEL_UP_SYNC_CONTRACTS,
  getLevelUpSyncContract,
  getLevelUpSyncContractsByStatus,
} from '../level-up/level-up-sync-contract'

const syncAuditSource = readFileSync(join(process.cwd(), 'docs/level-up-sync-audit.md'), 'utf8')
const portalSource = readFileSync(join(process.cwd(), 'app/player-development/_components/level-up-portal.tsx'), 'utf8')
const workbenchSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const playerSessionApiSource = readFileSync(join(process.cwd(), 'app/api/player/level-up-sessions/route.ts'), 'utf8')
const playerAssignmentsApiSource = readFileSync(join(process.cwd(), 'app/api/player/coach-assignments/route.ts'), 'utf8')
const coachAssignmentsApiSource = readFileSync(join(process.cwd(), 'app/api/coach/assignments/route.ts'), 'utf8')
const levelUpSessionsMigrationSource = readFileSync(join(process.cwd(), 'supabase/migrations/20260530000100_create_level_up_sessions.sql'), 'utf8')
const coachWorkspaceMigrationSource = readFileSync(join(process.cwd(), 'supabase/migrations/20260528000100_create_coach_workspace.sql'), 'utf8')
const backendSource = [
  playerSessionApiSource,
  playerAssignmentsApiSource,
  coachAssignmentsApiSource,
  levelUpSessionsMigrationSource,
  coachWorkspaceMigrationSource,
].join('\n')

describe('Level Up sync contract', () => {
  it('keeps every sync area documented with a test signal and fail-fast condition', () => {
    expect(LEVEL_UP_SYNC_CONTRACTS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(LEVEL_UP_SYNC_CONTRACTS.map((contract) => contract.id)).size).toBe(LEVEL_UP_SYNC_CONTRACTS.length)

    for (const contract of LEVEL_UP_SYNC_CONTRACTS) {
      expect(contract.label.trim(), contract.id).not.toHaveLength(0)
      expect(contract.userStory.trim(), contract.id).not.toHaveLength(0)
      expect(contract.sourceOfTruth.trim(), contract.id).not.toHaveLength(0)
      expect(contract.testSignal.trim(), contract.id).not.toHaveLength(0)
      expect(contract.failFastIf.trim(), contract.id).not.toHaveLength(0)
      expect(syncAuditSource, `${contract.id} missing from sync audit`).toContain(contract.label)
    }
  })

  it('points backend-backed and hybrid contracts at real tables or API routes', () => {
    for (const contract of LEVEL_UP_SYNC_CONTRACTS.filter((item) => item.status === 'backend-backed' || item.status === 'hybrid')) {
      expect(contract.backendTables.length, contract.id).toBeGreaterThan(0)
      expect(contract.apiRoutes.length, contract.id).toBeGreaterThan(0)

      for (const table of contract.backendTables) {
        expect(backendSource, `${contract.id} references missing backend table ${table}`).toContain(table)
      }
    }
  })

  it('keeps local-only and manual-copy storage expectations explicit in the UI code', () => {
    for (const contract of LEVEL_UP_SYNC_CONTRACTS.filter((item) => item.status === 'local-only' || item.status === 'manual-copy')) {
      expect(contract.localStorageKeys.length, contract.id).toBeGreaterThan(0)
      for (const key of contract.localStorageKeys) {
        expect(`${portalSource}\n${workbenchSource}`, `${contract.id} missing storage key ${key}`).toContain(key)
      }
    }
  })

  it('keeps proof history sync status language honest for local, Player+, and coach-invited users', () => {
    const proofHistory = getLevelUpSyncContract('proof-history')
    expect(proofHistory?.status).toBe('hybrid')
    expect(getLevelUpSyncContractsByStatus('hybrid').map((contract) => contract.id)).toContain('live-workbench-session')

    expect(portalSource).toContain('Saved locally. Sign in from a coach invite or Player+ to sync proof history.')
    expect(portalSource).toContain('Synced. Your linked coach can use this for the next lesson.')
    expect(portalSource).toContain('Synced to your Level Up history.')
    expect(workbenchSource).toContain('Free preview saved locally. Coach invite or Player+ turns on cloud history.')
    expect(workbenchSource).toContain('Synced. Coach assignment marked complete for review.')
  })
})
