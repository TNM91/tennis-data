import {LEVEL_UP_CARDS} from './level-up/level-up-cards'
import type {CoachAssignmentPack} from './coach-storage'

export type CoachLevelUpHandoffPack = {
  id: string
  title: string
  assignmentTitle: string
  focus: string
  detail: string
  cardIds: string[]
}

export const COACH_LEVEL_UP_HANDOFF_PACKS: CoachLevelUpHandoffPack[] = [
  {
    id: 'rhythm-builder',
    title: 'Rhythm Builder',
    assignmentTitle: 'First rhythm Level Up pack',
    focus: 'Ready feet, wall rhythm, and pre-play readiness',
    detail: 'Use this when a newer or returning player needs a simple repeatable rhythm before bigger tactical work.',
    cardIds: ['split-step-rhythm', 'wall-rally-rhythm', 'dynamic-tennis-warm-up'],
  },
  {
    id: 'consistency-builder',
    title: 'Consistency Builder',
    assignmentTitle: 'Consistency Level Up pack',
    focus: 'Crosscourt tolerance, wide-ball neutralizing, and post-play recovery',
    detail: 'Use this when the player needs fewer loose errors and a cleaner recovery habit between sessions.',
    cardIds: ['crosscourt-consistency', 'wide-ball-neutralizer', 'post-play-mobility-reset'],
  },
  {
    id: 'point-start-routine',
    title: 'Point-Start Routine',
    assignmentTitle: 'Point-start Level Up pack',
    focus: 'Serve target, return job, and 30-30 reset clarity',
    detail: 'Use this when a competitive player needs sharper first-two-shot habits under pressure.',
    cardIds: ['serve-target-call', 'return-depth-lane', '30-30-pressure-game'],
  },
  {
    id: 'doubles-readiness',
    title: 'Doubles Readiness',
    assignmentTitle: 'Doubles readiness Level Up pack',
    focus: 'Partner first move, poach timing, and 30-30 doubles clarity',
    detail: 'Use this when a player needs clearer partner jobs and proof-backed doubles habits between lessons.',
    cardIds: ['partner-first-move-call', 'poach-timing-shadow', 'doubles-30-30-game'],
  },
  {
    id: 'match-day-routine',
    title: 'Match-Day Routine',
    assignmentTitle: 'Match-day routine Level Up pack',
    focus: 'Warm-up, return intent, and post-match debrief',
    detail: 'Use this when the next lesson needs a player to arrive with proof from match-day routines.',
    cardIds: ['five-minute-match-primer', 'return-30-30-game', 'post-match-five-minute-debrief'],
  },
]

export function coachPracticePack(id:string):CoachAssignmentPack|null{
 const pack=COACH_LEVEL_UP_HANDOFF_PACKS.find(p=>p.id===id)
 if(!pack)return null
 const items=pack.cardIds.map(id=>LEVEL_UP_CARDS.find(c=>c.id===id)).filter(c=>!!c).map(c=>({cardId:c.id,title:c.title,proof:c.proof,status:'assigned' as const}))
 return {id:pack.id,title:pack.title,focus:pack.focus,items}
}
