import type { PlayerDevelopmentIdentity } from './player-development'

export type PlayerTrainingMenus = {
  solo: string[][]
  partner: string[][]
  offCourt: string[][]
  performance: string[][]
}

export function getPlayerTrainingMenus(identity: PlayerDevelopmentIdentity): PlayerTrainingMenus {
  const isRelentless = identity.slug.includes('relentless')

  return {
    solo: isRelentless
      ? [
          ['Serve target reps', 'Call wide, body, or T before every serve. Chart made target and whether the routine stayed the same.'],
          ['Shadow recovery lanes', 'Drop a cone at recovery position. Hit or shadow, recover before watching the result, then reset.'],
          ['Wall rhythm ladder', 'Use crosscourt-height targets on a wall. Count only balanced contacts with active feet after contact.'],
          ['Pressure routine rehearsal', 'Start every rep at 30-30 in your head. Breathe, name target, commit, reset.'],
        ]
      : [
          ['Serve plus-one shadow', 'Call serve target, shadow the first ball lane, recover, then repeat with a new location.'],
          ['Approach footwork ladder', 'Move through short-ball contact, close, split, and recover without pausing at contact.'],
          ['Wall depth builder', 'Work heavy crosscourt shape before a controlled line-change target.'],
          ['Decision rehearsal', 'Call neutral, build, attack, or finish before each shadow swing.'],
        ],
    partner: isRelentless
      ? [
          ['Wide-ball reset game', 'Partner feeds wide. You must reset high crosscourt, recover, then play the next ball neutral.'],
          ['Offense-neutral-defense rally', 'Call the ball before contact: defend, neutralize, or attack. Attack only when the ball is earned.'],
          ['Second-serve plus one', 'Start each point with a second serve. Score only if the next ball is ready and controlled.'],
          ['Late-game footwork set', 'Play first to 7 starting at 30-30. Bonus point if feet stay active after contact.'],
        ]
      : [
          ['Crosscourt earn-and-change', 'Build three deep crosscourts before changing line only from balance.'],
          ['Short-ball close', 'Partner feeds short after depth. Player approaches, closes, splits, and finishes placement.'],
          ['Return step-in game', 'Partner serves second serves. Returner steps in and scores for depth plus recovery.'],
          ['Attack reset rally', 'If the attack is not earned, player must reset and rebuild instead of forcing.'],
        ],
    offCourt: isRelentless
      ? [
          ['Match note in five minutes', 'Write one proof, one leak, and one next practice focus within five minutes after play.'],
          ['Pressure breath routine', 'Practice the same breath, target call, and reset phrase before ten imagined pressure points.'],
          ['Opponent plan card', 'Before a match, write the opponent style and the first three-game adjustment.'],
          ['Coach handoff note', 'Bring one question, one proof note, and one habit request to the next lesson.'],
        ]
      : [
          ['Pattern notebook', 'Write the pattern that earned short balls and the ball you were trying to create.'],
          ['Balance audit', 'After match play, list three attacks: earned, forced, or rushed.'],
          ['First-strike plan card', 'Before play, choose serve target, first ball, and recovery cue.'],
          ['Coach handoff note', 'Bring one question, one proof note, and one habit request to the next lesson.'],
        ],
    performance: isRelentless
      ? [
          ['Dynamic warm-up', '6-8 minutes before tennis: march or jog, arm circles, side shuffle, crossover steps, knee hug to lunge, lateral lunge, split-step bounce, first-step rhythm, and optional jump rope 60-90 seconds. Track body ready 0-5.'],
          ['Jump rope rhythm builder', '3-5 rounds: jump rope 30 sec, rest 20 sec, then split-step + first move x6. Keep shoulders relaxed and breathing calm. Track rhythm and light feet 0-5.'],
          ['Cone recover + shadow swing', 'Set one home cone and two wide cones. Move to a cone, shadow forehand or backhand, recover to home before watching the imaginary result. Do 3 rounds of 6 reps. Track recovery after contact 0-5.'],
          ['Lower-body recovery circuit', '2-3 rounds: split squat x8 each side, lateral lunge x8 each side, wall sit 30-45 sec, calf raise x12, split-step bounce x10, shadow hit + recover x8. Track leg durability 0-5.'],
          ['Shoulder + core support', '2-3 rounds: band row x12, band external rotation x10 each side, dead bug x8 each side, side plank 20-30 sec each side, serve-routine shadow x8. Track serve routine clarity 0-5.'],
          ['Tennis conditioning finisher', '8 minutes: 20 sec work / 20 sec reset. Rotate jump rope, cone shuffle, shadow forehand/backhand recover, skater stick, fast march or mountain climber, serve routine shadow, and wide-ball recover. Track posture under fatigue 0-5.'],
          ['Post-play mobility reset', '6-10 minutes after play: hip flexor, hamstring, calf, figure-four glute, thoracic open book, child pose side reach, shoulder cross-body, and five slow breaths. Track tension before/after 0-5.'],
        ]
      : [
          ['Dynamic warm-up', '6-8 minutes before tennis: march or jog, arm circles, side shuffle, crossover steps, knee hug to lunge, lateral lunge, split-step bounce, first-step rhythm, and optional jump rope 60-90 seconds. Track body ready 0-5.'],
          ['Jump rope rhythm builder', '3-5 rounds: jump rope 30 sec, rest 20 sec, then split-step + first move x6. Keep the rhythm light and controlled. Track light feet 0-5.'],
          ['Cone close + recover', 'Set one home cone, one short-ball cone, and one recovery cone. Move forward, shadow approach, close, split, then recover. Do 3 rounds of 5 reps. Track forward-close balance 0-5.'],
          ['Forward-close strength', '2-3 rounds: split squat x8 each side, step-up x8 each side, glute bridge x12, wall sit 30-45 sec, calf raise x12, approach-shadow close x8. Track forward balance 0-5.'],
          ['Core + balance circuit', '2-3 rounds: single-leg RDL x6 each side, dead bug x8 each side, side plank 20-30 sec each side, wall sit with quiet upper body 30 sec, decision shadow x8. Track attack control 0-5.'],
          ['First-strike conditioning', '8 minutes: serve +1 shadow, jump rope, recovery step, lateral cone shuffle, split-step, and short-ball close in 20/20 intervals. Track clarity under fatigue 0-5.'],
          ['Post-play mobility reset', '6-10 minutes after play: hip flexor, hamstring, calf, glute, thoracic rotation, shoulder stretch, and slow breathing. Track tension before/after 0-5.'],
        ],
  }
}
