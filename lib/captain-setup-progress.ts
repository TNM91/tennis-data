import type { CaptainImportHandoff } from './captain-import-handoff'
import type { CaptainTeamScope } from './captain-team-scope'

export type CaptainSetupStep = 'player' | 'team' | 'schedule' | 'ready'

export type CaptainSetupProgress = {
  hasPlayer: boolean
  hasTeam: boolean
  hasMatchData: boolean
  nextStep: CaptainSetupStep
}

export function getCaptainSetupProgress(input: {
  profile?: {
    linked_player_id?: string | null
    linked_player_name?: string | null
    linked_team_name?: string | null
  } | null
  teamScopes?: CaptainTeamScope[]
  teamOptions?: Array<{ matches?: number | null }>
  importHandoff?: CaptainImportHandoff | null
}): CaptainSetupProgress {
  const hasPlayer = Boolean(cleanText(input.profile?.linked_player_id) || cleanText(input.profile?.linked_player_name))
  const hasTeam = Boolean(
    cleanText(input.profile?.linked_team_name)
    || input.teamScopes?.some((scope) => cleanText(scope.team))
    || input.teamOptions?.length
    || cleanText(input.importHandoff?.team),
  )
  const hasMatchData = Boolean(
    input.teamOptions?.some((option) => Number(option.matches || 0) > 0)
    || (input.importHandoff?.importType === 'schedule' && input.importHandoff.matches > 0),
  )

  return {
    hasPlayer,
    hasTeam,
    hasMatchData,
    nextStep: !hasPlayer ? 'player' : !hasTeam ? 'team' : !hasMatchData ? 'schedule' : 'ready',
  }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
