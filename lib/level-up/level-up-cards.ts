import type { LevelUpCard, LevelUpCategory, LevelUpEquipment, LevelUpIntensity, LevelUpLevel, LevelUpModule, LevelUpSetting } from './level-up-types'

type CardSeed = {
  title: string
  category: LevelUpCategory
  pack: string
  setting: LevelUpSetting[]
  equipment: LevelUpEquipment[]
  tags: string[]
  durationMinutes?: number
  level?: LevelUpLevel
  intensity?: LevelUpIntensity
  identitySlugs?: string[]
}

type CardContentEnhancement = Partial<Pick<LevelUpCard, 'useWhen' | 'tennisGoal' | 'cue' | 'routine' | 'reward' | 'proof' | 'progression' | 'regression' | 'safetyNote'>>

const identityMap: Record<string, string[]> = {
  serve: ['relentless-competitor-4-0'],
  movement: ['relentless-competitor-4-0'],
  pressure: ['relentless-competitor-4-0'],
  conditioning: ['relentless-competitor-4-0'],
  attack: ['smart-attacker-4-0-to-4-5'],
  doubles: ['smart-attacker-4-0-to-4-5'],
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function identitySlugsFor(tags: string[]) {
  return [...new Set(tags.flatMap((tag) => identityMap[tag] ?? []))]
}

const cardContentEnhancements: Record<string, CardContentEnhancement> = {
  'cone-recover-shadow-swing': {
    useWhen: 'Use this when you finish shots and catch yourself watching instead of recovering.',
    tennisGoal: 'Build the habit of recovering before judging the shot so you are ready for the next ball.',
    cue: 'Hit, hold your finish, then recover before you look.',
    routine: ['Set two cones for your recovery lane.', 'Shadow a controlled swing and call recover.', 'Move back through the cone gate before watching the imaginary ball.', 'Repeat 3 rounds and score how automatic the recovery felt.'],
    reward: 'You leave with a visible after-contact habit you can use on every rally ball.',
    proof: 'Recovered before watching 0-5',
    progression: 'Add a second shadow ball or shorten the recovery window only after the finish stays balanced.',
    regression: 'Remove the swing and rehearse split, recover, and balance first.',
  },
  'jump-rope-rhythm-builder': {
    useWhen: 'Use this before practice when your feet feel heavy or your timing feels late.',
    tennisGoal: 'Build light, quiet foot rhythm that supports split-step timing and first move quality.',
    cue: 'Quiet feet, tall posture, soft landings.',
    routine: ['Jump lightly for 30 seconds.', 'Rest and shadow a split-step plus first move.', 'Repeat 4 rounds without chasing speed.', 'Score rhythm, posture, and control.'],
    reward: 'You start the court session with better rhythm instead of waiting for rallies to wake your feet up.',
    proof: 'Light feet and quiet landings 0-5',
    safetyNote: 'Jump rope should stay light and quiet. Stop if landings change your movement quality.',
  },
  'wall-sit-leg-durability': {
    useWhen: 'Use this when late points make your legs stand up or your posture break.',
    tennisGoal: 'Connect leg durability to staying low, balanced, and decision-ready late in games.',
    cue: 'Strong legs, quiet shoulders, steady breathing.',
    routine: ['Hold a controlled wall sit for 20-40 seconds.', 'Stand, breathe, and shadow two recovery steps.', 'Repeat 3 rounds with clean posture.', 'Score whether posture held under fatigue.'],
    reward: 'You get a simple leg check that ties directly to late-match posture.',
    proof: 'Posture under leg fatigue 0-5',
    safetyNote: 'Keep the hold technique-first. Stop if pain changes posture or movement.',
  },
  'serve-target-call': {
    useWhen: 'Use this when your serve plan gets vague or pressure makes you rush.',
    tennisGoal: 'Make every serve rep start with a clear target, routine, and recovery intention.',
    cue: 'Call it before you start the motion.',
    routine: ['Choose body, wide, or T.', 'Say the target out loud.', 'Run the same breath and bounce routine.', 'Serve or shadow, then score target clarity before the next rep.'],
    reward: 'Your serve practice becomes decision training instead of random reps.',
    proof: 'Serve target clarity 0-5',
    progression: 'Add score pressure by starting each round at 30-30.',
    regression: 'Shadow the routine without hitting until the target call feels automatic.',
  },
  'three-step-reset': {
    useWhen: 'Use this after errors, double faults, or rushed points.',
    tennisGoal: 'Build a between-point routine that helps you return to the next playable ball.',
    cue: 'Breathe, name it, choose the next target.',
    routine: ['Turn away from the last point.', 'Take one slow breath.', 'Name the next intention in five words or fewer.', 'Pick the next target and start the point.'],
    reward: 'You practice responding to pressure instead of carrying it into the next ball.',
    proof: 'Reset used before next point 0-5',
  },
  'wide-ball-neutralizer': {
    useWhen: 'Use this when wide balls turn into panic shots or rushed misses.',
    tennisGoal: 'Train the wide-ball response that gets you from defense back to neutral.',
    cue: 'Height, depth, recover.',
    routine: ['Start outside the singles line.', 'Shadow or hit a high crosscourt neutral ball.', 'Recover behind the baseline cone.', 'Score whether you defended without rushing the change of direction.'],
    reward: 'You get a reliable defensive pattern for balls that pull you off court.',
    proof: 'Defense to neutral response 0-5',
  },
  'post-play-mobility-reset': {
    useWhen: 'Use this after practice, matches, or conditioning blocks.',
    tennisGoal: 'Bring the body back toward control so the next session starts cleaner.',
    cue: 'Slow down, breathe, re-check range.',
    routine: ['Pick hips, calves, shoulders, or back.', 'Move slowly for 45 seconds each side.', 'Breathe through the reset without forcing range.', 'Re-check how ready you feel.'],
    reward: 'You finish training with a simple recovery habit instead of just stopping.',
    proof: 'Post-play reset quality 0-5',
    safetyNote: 'Static resets belong after play or recovery blocks. Do not force range.',
  },
  'serve-1-shadow': {
    useWhen: 'Use this when your serve and first ball feel disconnected.',
    tennisGoal: 'Link serve target to the next-ball intention before adding live points.',
    cue: 'Serve target creates the first move.',
    routine: ['Call the serve target.', 'Shadow the serve finish.', 'Shadow the expected plus-one ball.', 'Recover and rate whether the two actions matched.'],
    reward: 'You stop thinking of the serve as one isolated shot.',
    proof: 'Serve plus-one connection 0-5',
  },
  'return-step-in-game': {
    useWhen: 'Use this when return games start passive or unclear.',
    tennisGoal: 'Choose return position and intent before the server starts the point.',
    cue: 'Step in with a job.',
    routine: ['Choose block, drive, or height.', 'Start with active feet before the toss.', 'Return with the chosen shape.', 'Recover and score whether the intent showed up.'],
    reward: 'You turn returns into planned starts instead of reactions.',
    proof: 'Return intent 0-5',
  },
  'partner-first-move-call': {
    useWhen: 'Use this when doubles points start with both players guessing.',
    tennisGoal: 'Make the first move visible between partners before the serve or return.',
    cue: 'Say the first move before the point starts.',
    routine: ['Call serve or return direction.', 'Partner calls first move.', 'Play the point with that first move in mind.', 'Score communication before discussing the result.'],
    reward: 'Your doubles team gets alignment before the ball is live.',
    proof: 'Partner first-move clarity 0-5',
  },
}

function makeCard(seed: CardSeed): LevelUpCard {
  const id = slugify(seed.title)
  const duration = seed.durationMinutes ?? (seed.category === 'mental-routine' ? 4 : seed.category === 'mobility-stretch' ? 8 : 10)
  const level = seed.level ?? 'starter'
  const intensity = seed.intensity ?? (seed.category === 'mobility-stretch' || seed.category === 'mental-routine' ? 'low' : 'medium')
  const identitySlugs = seed.identitySlugs ?? identitySlugsFor(seed.tags)
  const content = cardContentEnhancements[id] ?? {}

  return {
    id,
    title: seed.title,
    category: seed.category,
    pack: seed.pack,
    level,
    setting: seed.setting,
    equipment: seed.equipment,
    durationMinutes: duration,
    intensity,
    assignable: true,
    favoriteable: true,
    useWhen: content.useWhen ?? buildUseWhen(seed),
    tennisGoal: content.tennisGoal ?? buildTennisGoal(seed),
    cue: content.cue ?? buildCue(seed),
    routine: content.routine ?? buildRoutine(seed),
    reward: content.reward ?? buildReward(seed),
    proof: content.proof ?? buildProof(seed),
    ratingLabels: ['Cue', 'Routine', 'Reward', 'Proof'],
    progression: content.progression ?? buildProgression(seed, level),
    regression: content.regression ?? buildRegression(seed),
    safetyNote: content.safetyNote ?? buildSafetyNote(seed),
    tags: seed.tags,
    identitySlugs: identitySlugs.length ? identitySlugs : undefined,
  }
}

function buildUseWhen(seed: CardSeed) {
  if (seed.tags.includes('match-day')) return 'Use this before or during match day when you need a simple routine you can trust.'
  if (seed.tags.includes('recovery') || seed.category === 'recovery-reset') return 'Use this after play when your body and attention need to come back to neutral.'
  if (seed.tags.includes('wall')) return 'Use this when you have a wall and want reps that include recovery, not just contact.'
  if (seed.tags.includes('jump-rope')) return 'Use this when you need light feet before tennis work or a short conditioning block.'
  if (seed.tags.includes('attack')) return 'Use this when attacking gets rushed and you need balance before the finish.'
  if (seed.tags.includes('defense')) return 'Use this when defense turns into panic and you need a calmer neutral ball.'
  if (seed.tags.includes('consistency')) return 'Use this when you need rally discipline before changing direction or pace.'
  if (seed.category === 'serve-return') return 'Use this when serve or return reps need a clearer job than just getting the ball in.'
  if (seed.category === 'partner-drill') return 'Use this when you have a partner and want a constraint that makes the rally purposeful.'
  if (seed.category === 'doubles-drill') return 'Use this when doubles communication or first movement needs to be clearer.'
  if (seed.category === 'conditioning') return 'Use this when you want conditioning that still connects to tennis posture and decisions.'
  if (seed.category === 'strength-stability') return 'Use this when off-court strength needs to support balance, posture, or repeatable movement.'
  return 'Use this when the skill needs focused reps and a simple proof score.'
}

function buildTennisGoal(seed: CardSeed) {
  if (seed.tags.includes('serve')) return 'Build a serve habit that connects target, routine, recovery, and the next ball.'
  if (seed.tags.includes('return')) return 'Build a return habit that starts the point with clear intent and recovery.'
  if (seed.tags.includes('doubles')) return 'Build a doubles habit your partner can see, hear, and move with.'
  if (seed.tags.includes('pressure')) return 'Build a pressure response that helps the next point start clean.'
  if (seed.tags.includes('movement') || seed.tags.includes('light-feet')) return 'Build movement quality that helps you arrive balanced and recover on time.'
  if (seed.tags.includes('conditioning')) return 'Build fatigue tolerance without losing posture, balance, or decision quality.'
  return `Build a tennis-specific ${seed.tags[0]?.replaceAll('-', ' ') ?? 'development'} habit that transfers to practice or match play.`
}

function buildCue(seed: CardSeed) {
  if (seed.tags.includes('recovery-after-contact') || seed.tags.includes('recovery')) return 'Finish, recover, then read the next ball.'
  if (seed.tags.includes('serve')) return 'Target first, routine second, swing third.'
  if (seed.tags.includes('return')) return 'Choose the return job before the toss.'
  if (seed.tags.includes('pressure')) return 'Slow down before the next point speeds up.'
  if (seed.tags.includes('doubles')) return 'Call the first move before the ball is live.'
  if (seed.tags.includes('wall')) return 'Hit, recover, and reset the feet before the next ball.'
  if (seed.tags.includes('attack')) return 'Close with balance before you choose the finish.'
  if (seed.tags.includes('defense')) return 'Height, depth, recover, then breathe.'
  if (seed.tags.includes('conditioning')) return 'Keep tennis posture when fatigue shows up.'
  if (seed.tags.includes('balance')) return 'Stick the finish before adding speed.'
  if (seed.tags.includes('light-feet')) return 'Land quiet and move with control.'
  if (seed.category === 'mobility-stretch' || seed.category === 'recovery-reset') return 'Move slowly and re-check readiness.'
  return seed.tags.includes('match-day') ? 'Prepare the same way before pressure starts.' : 'One tennis job, clean reps, honest score.'
}

function buildRoutine(seed: CardSeed) {
  if (seed.category === 'mental-routine') {
    return ['Name the trigger.', 'Take one slow breath.', 'Say the cue phrase.', 'Choose the next target.']
  }
  if (seed.category === 'mobility-stretch' || seed.category === 'recovery-reset') {
    return ['Move slowly for 30 seconds each side.', 'Breathe through the tight spot.', 'Re-check posture or range.', 'Rate before and after.']
  }
  if (seed.category === 'serve-return') {
    return ['Call the target.', 'Run the routine.', 'Hit or shadow the rep.', 'Recover and score the proof.']
  }
  if (seed.category === 'movement-engine') {
    return ['Set the cone, line, or shadow lane.', 'Do 6 clean reps with the cue.', 'Recover to a balanced ready position.', 'Rest briefly, repeat 3 rounds, then score the proof.']
  }
  if (seed.category === 'conditioning') {
    return ['Set a short work window.', 'Move with tennis posture, not max speed.', 'Rest before movement quality breaks.', 'Score whether decisions stayed clear under fatigue.']
  }
  if (seed.category === 'strength-stability') {
    return ['Choose the controlled version first.', 'Do 6-8 technique-first reps each side.', 'Reset posture and breathing between sets.', 'Score control, balance, and tennis posture.']
  }
  if (seed.category === 'solo-drill') {
    return ['Pick the target or wall rule.', 'Hit a short block of clean reps.', 'Recover before watching the result.', 'Score whether the habit showed up.']
  }
  if (seed.category === 'partner-drill' || seed.category === 'doubles-drill') {
    return ['Set the constraint.', 'Play the rep.', 'Call the cue out loud.', 'Score the habit before changing drills.']
  }
  return ['Choose one tennis job.', 'Do 6-10 clean reps.', 'Reset posture and breathing.', 'Repeat for 3 rounds and score the proof.']
}

function buildReward(seed: CardSeed) {
  if (seed.category === 'mental-routine') return 'You finish with a routine you can use before the next point, not a long journal entry.'
  if (seed.category === 'movement-engine') return 'You finish with movement that connects contact, recovery, and the next ready position.'
  if (seed.category === 'solo-drill') return 'You finish with reps that have a target, a recovery habit, and a score you can compare later.'
  if (seed.category === 'partner-drill' || seed.category === 'doubles-drill') return 'You finish with shared language and one measurable habit to carry into points.'
  if (seed.category === 'conditioning' || seed.category === 'strength-stability') return 'You finish with body work that has a clear tennis reason behind it.'
  return 'You finish with one repeatable tennis habit and a proof score you can track.'
}

function buildProof(seed: CardSeed) {
  if (seed.tags.includes('serve-target')) return 'Serve target clarity 0-5'
  if (seed.tags.includes('serve-routine')) return 'Serve routine clarity 0-5'
  if (seed.tags.includes('serve-plus-one')) return 'Serve plus-one connection 0-5'
  if (seed.tags.includes('recovery-after-contact')) return 'Recovery after contact 0-5'
  if (seed.tags.includes('recover-before-watching')) return 'Recovered before watching 0-5'
  if (seed.tags.includes('pressure-reset')) return 'Reset used before next point 0-5'
  if (seed.tags.includes('between-points')) return 'Between-point routine used 0-5'
  if (seed.tags.includes('doubles-communication')) return 'Doubles communication clarity 0-5'
  if (seed.tags.includes('partner-first-move')) return 'Partner first-move clarity 0-5'
  if (seed.tags.includes('poach-timing')) return 'Poach timing clarity 0-5'
  if (seed.tags.includes('leg-durability')) return 'Posture under fatigue 0-5'
  if (seed.tags.includes('posture-under-fatigue')) return 'Posture under fatigue 0-5'
  if (seed.tags.includes('defense-to-neutral')) return 'Defense to neutral response 0-5'
  if (seed.tags.includes('wide-ball-reset') || seed.tags.includes('defense')) return 'Wide-ball reset quality 0-5'
  if (seed.tags.includes('attack-balance')) return 'Balanced attack decision 0-5'
  if (seed.tags.includes('forward-close')) return 'Forward close and recover 0-5'
  if (seed.tags.includes('crosscourt-build') || seed.tags.includes('consistency')) return 'Crosscourt build quality 0-5'
  if (seed.tags.includes('return-intent') || seed.tags.includes('return')) return 'Return intent and recovery 0-5'
  if (seed.tags.includes('serve')) return 'Serve routine transfer 0-5'
  if (seed.tags.includes('wall-work') || seed.tags.includes('wall')) return 'Wall rep quality and recovery 0-5'
  if (seed.tags.includes('jump-rope')) return 'Light feet and quiet landings 0-5'
  if (seed.tags.includes('split-step')) return 'Split-step timing 0-5'
  if (seed.tags.includes('first-step')) return 'First-step readiness 0-5'
  if (seed.tags.includes('light-feet')) return 'Light feet and first move 0-5'
  if (seed.tags.includes('recovery')) return 'Recovery habit quality 0-5'
  if (seed.tags.includes('balance')) return 'Balanced finish and control 0-5'
  if (seed.tags.includes('core-control') || seed.tags.includes('core')) return 'Core control with tennis posture 0-5'
  if (seed.tags.includes('shoulder-support') || seed.tags.includes('shoulder')) return 'Shoulder control for serve rhythm 0-5'
  if (seed.tags.includes('strength')) return 'Technique-first strength quality 0-5'
  if (seed.tags.includes('conditioning')) return 'Decision quality under fatigue 0-5'
  if (seed.tags.includes('pressure')) return 'Pressure response quality 0-5'
  if (seed.tags.includes('match-day')) return 'Match-day readiness 0-5'
  if (seed.tags.includes('warm-up')) return 'Ready before play 0-5'
  if (seed.tags.includes('mobility')) return 'Readiness after reset 0-5'
  if (seed.tags.includes('stretch')) return 'Controlled range reset 0-5'
  if (seed.category === 'movement-engine') return 'Arrived balanced and recovered 0-5'
  if (seed.category === 'solo-drill') return 'Rep quality with clear target 0-5'
  if (seed.category === 'partner-drill') return 'Rally habit quality 0-5'
  if (seed.category === 'doubles-drill') return 'Doubles decision clarity 0-5'
  if (seed.category === 'mental-routine') return 'Routine used before next ball 0-5'
  return `${seed.title} habit quality 0-5`
}

function buildProgression(seed: CardSeed, level: LevelUpLevel) {
  if (seed.category === 'serve-return' || seed.category === 'mental-routine') return 'Add score pressure only after the routine stays the same for three clean reps.'
  if (seed.category === 'partner-drill' || seed.category === 'doubles-drill') return 'Add a score target or narrower constraint when the communication stays clear.'
  if (level === 'advanced') return 'Add score pressure or shorter rest while keeping the proof score honest.'
  return 'Add one round or a target score when it feels clean.'
}

function buildRegression(seed: CardSeed) {
  if (seed.category === 'serve-return') return 'Shadow the pattern first, then add the ball.'
  if (seed.category === 'partner-drill' || seed.category === 'doubles-drill') return 'Remove scoring and rehearse the cue with slower feeds.'
  if (seed.category === 'conditioning' || seed.category === 'strength-stability') return 'Cut the work in half and keep posture clean.'
  if (seed.category === 'movement-engine') return 'Walk the pattern first, then add tennis speed only when balance stays clean.'
  if (seed.category === 'solo-drill') return 'Shorten the target area or slow the feed until contact and recovery both hold.'
  return 'Cut the reps in half and keep the tennis job clean.'
}

function buildSafetyNote(seed: CardSeed) {
  if (seed.category === 'conditioning') return 'Choose control before intensity. Stop if fatigue changes your movement quality.'
  if (seed.category === 'strength-stability') return 'Technique first. Stop if pain changes posture or movement.'
  if (seed.category === 'mobility-stretch' || seed.category === 'recovery-reset') return 'Move slowly. Do not force range.'
  return undefined
}

const CARD_SEEDS: CardSeed[] = [
  { title: 'Split-Step Rhythm', category: 'movement-engine', pack: 'Movement Engine', setting: ['home', 'court'], equipment: ['none'], tags: ['movement', 'split-step', 'light-feet'] },
  { title: 'Split + Recover Loop', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['movement', 'recovery'] },
  { title: 'Cone Recover + Shadow Swing', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['recovery-after-contact', 'recover-before-watching', 'shadow-swing', 'cones', 'light-feet'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Four-Cone Tennis Star', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['movement', 'cones'] },
  { title: 'Three-Cone Baseline Recover', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'baseline'] },
  { title: 'Wide-Ball Neutralizer', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'defense'] },
  { title: 'Short-Ball Close + Split', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'attack'] },
  { title: 'Cone Close + Recover', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['forward-close', 'attack-balance', 'recovery-after-contact', 'cones'], identitySlugs: ['smart-attacker-4-0-to-4-5'] },
  { title: 'Drop-Step Recovery', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['movement', 'recovery'] },
  { title: 'Crossover Recovery Lane', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'recovery'] },
  { title: 'Lateral Decel Stick', category: 'movement-engine', pack: 'Movement Engine', setting: ['home', 'court'], equipment: ['none'], tags: ['movement', 'balance'] },
  { title: 'Skater Stick + Shadow', category: 'movement-engine', pack: 'Movement Engine', setting: ['home', 'court'], equipment: ['none'], tags: ['movement', 'balance'] },
  { title: 'Figure-8 Cone Movement', category: 'movement-engine', pack: 'Movement Engine', setting: ['driveway', 'court'], equipment: ['cones'], tags: ['movement', 'cones'] },
  { title: 'Serve + Recover Feet', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['basket'], tags: ['movement', 'serve'] },
  { title: 'Jump Rope Starter', category: 'movement-engine', pack: 'Jump Rope Rhythm', setting: ['home', 'driveway', 'garage', 'court'], equipment: ['jump-rope'], tags: ['jump-rope', 'light-feet'] },
  { title: 'Jump Rope Rhythm Builder', category: 'movement-engine', pack: 'Jump Rope Rhythm', setting: ['home', 'driveway', 'garage', 'court'], equipment: ['jump-rope'], tags: ['jump-rope', 'movement', 'warm-up'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Jump Rope + Shadow Rally', category: 'movement-engine', pack: 'Jump Rope Rhythm', setting: ['home', 'driveway'], equipment: ['jump-rope'], tags: ['jump-rope', 'shadow'] },
  { title: 'Jump Rope Serve Prep', category: 'movement-engine', pack: 'Jump Rope Rhythm', setting: ['home', 'court'], equipment: ['jump-rope'], tags: ['jump-rope', 'serve'] },
  { title: 'Jump Rope Return Prep', category: 'movement-engine', pack: 'Jump Rope Rhythm', setting: ['home', 'court'], equipment: ['jump-rope'], tags: ['jump-rope', 'return'] },
  { title: 'Jump Rope Intervals', category: 'conditioning', pack: 'Jump Rope Rhythm', setting: ['home', 'driveway', 'garage'], equipment: ['jump-rope'], tags: ['jump-rope', 'conditioning'], durationMinutes: 8 },
  { title: 'Wall Sit Leg Durability', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'garage', 'gym'], equipment: ['wall'], tags: ['conditioning', 'leg-durability'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Split Squat Control', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'gym'], equipment: ['none'], tags: ['strength', 'balance'] },
  { title: 'Single-Leg RDL', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'gym'], equipment: ['none'], tags: ['balance', 'core-control', 'leg-durability', 'no-equipment'], identitySlugs: ['smart-attacker-4-0-to-4-5'] },
  { title: 'Reverse Lunge + Recover', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'gym'], equipment: ['none'], tags: ['strength', 'recovery'] },
  { title: 'Lateral Lunge + Shadow', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'gym'], equipment: ['none'], tags: ['strength', 'movement'] },
  { title: 'Step-Up + Split', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'gym'], equipment: ['chair'], tags: ['strength', 'split-step'] },
  { title: 'Late-Set Legs Circuit', category: 'conditioning', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'gym', 'court'], equipment: ['none'], tags: ['conditioning', 'pressure'], intensity: 'high' },
  { title: 'Dead Bug + Serve Shadow', category: 'strength-stability', pack: 'Core, Balance & Rotation', setting: ['home', 'gym'], equipment: ['none'], tags: ['core', 'serve'] },
  { title: 'Side Plank + Reach', category: 'strength-stability', pack: 'Core, Balance & Rotation', setting: ['home', 'gym'], equipment: ['none'], tags: ['core', 'rotation'] },
  { title: 'Front Plank Breathing', category: 'strength-stability', pack: 'Core, Balance & Rotation', setting: ['home', 'gym'], equipment: ['none'], tags: ['core', 'breathing'] },
  { title: 'Pallof Press', category: 'strength-stability', pack: 'Core, Balance & Rotation', setting: ['home', 'gym'], equipment: ['resistance-band'], tags: ['core', 'rotation'] },
  { title: 'Band External Rotation', category: 'strength-stability', pack: 'Shoulder + Serve Support', setting: ['home', 'gym'], equipment: ['resistance-band'], tags: ['serve', 'shoulder'] },
  { title: 'Band Pull-Apart', category: 'strength-stability', pack: 'Shoulder + Serve Support', setting: ['home', 'gym'], equipment: ['resistance-band'], tags: ['shoulder', 'posture'] },
  { title: 'Wall Angels', category: 'mobility-stretch', pack: 'Shoulder + Serve Support', setting: ['home', 'gym'], equipment: ['wall'], tags: ['shoulder', 'mobility'] },
  { title: 'Serve Shadow Slow Motion', category: 'serve-return', pack: 'Shoulder + Serve Support', setting: ['home', 'court'], equipment: ['none'], tags: ['serve', 'shadow'] },
  { title: 'Towel Serve Flow', category: 'serve-return', pack: 'Shoulder + Serve Support', setting: ['home', 'court'], equipment: ['towel'], tags: ['serve', 'routine'] },
  { title: '20/20 Tennis Finisher', category: 'conditioning', pack: 'Conditioning Finishers', setting: ['home', 'court'], equipment: ['none'], tags: ['conditioning', 'finish'] },
  { title: 'Cone Shuffle Finisher', category: 'conditioning', pack: 'Conditioning Finishers', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['conditioning', 'movement'] },
  { title: 'Serve +1 Conditioning', category: 'conditioning', pack: 'Conditioning Finishers', setting: ['court'], equipment: ['basket'], tags: ['conditioning', 'serve'] },
  { title: 'Return +1 Conditioning', category: 'conditioning', pack: 'Conditioning Finishers', setting: ['court'], equipment: ['partner'], tags: ['conditioning', 'return'] },
  { title: 'Dynamic Tennis Warm-Up', category: 'mobility-stretch', pack: 'Mobility Reset + Stretches', setting: ['court', 'match-day'], equipment: ['none'], tags: ['warm-up', 'match-day'] },
  { title: 'Five-Minute Match Primer', category: 'match-prep', pack: 'Mobility Reset + Stretches', setting: ['court', 'match-day'], equipment: ['none'], tags: ['match-day', 'warm-up'] },
  { title: 'Worlds Greatest Stretch', category: 'mobility-stretch', pack: 'Mobility Reset + Stretches', setting: ['home', 'court'], equipment: ['none'], tags: ['mobility', 'stretch'] },
  { title: 'Thoracic Open Book', category: 'mobility-stretch', pack: 'Mobility Reset + Stretches', setting: ['home'], equipment: ['none'], tags: ['mobility', 'recovery'] },
  { title: 'Post-Play Mobility Reset', category: 'recovery-reset', pack: 'Recovery Mode', setting: ['home', 'court', 'match-day'], equipment: ['none'], tags: ['recovery', 'mobility'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Wall Rally Rhythm', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'rhythm'] },
  { title: 'Wall Depth Builder', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'depth'] },
  { title: 'Wall Recovery Rule', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'recovery'] },
  { title: 'Wall Alternating FH/BH', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'strokes'] },
  { title: 'Cue Phrase Shadow', category: 'mental-routine', pack: 'Wall + Shadow Work', setting: ['home', 'court'], equipment: ['none'], tags: ['mental-routine', 'cue'] },
  { title: 'Serve Target Ladder', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve', 'target'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Serve Target Call', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve-routine', 'serve-target', 'decision-quality'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Second-Serve Routine Reps', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve', 'routine', 'pressure'] },
  { title: 'Serve +1 Shadow', category: 'serve-return', pack: 'Serve + Return', setting: ['court', 'home'], equipment: ['none'], tags: ['serve', 'attack'] },
  { title: 'Recover Before Score', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['recover-before-watching', 'recovery-after-contact', 'between-points', 'quick-win'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Basket Forehand Crosscourt', category: 'solo-drill', pack: 'Solo Court Drills', setting: ['court'], equipment: ['basket'], tags: ['attack', 'forehand'] },
  { title: 'Basket Backhand Crosscourt', category: 'solo-drill', pack: 'Solo Court Drills', setting: ['court'], equipment: ['basket'], tags: ['strokes', 'backhand'] },
  { title: 'Pressure Basket', category: 'solo-drill', pack: 'Solo Court Drills', setting: ['court'], equipment: ['basket'], tags: ['pressure', 'basket'] },
  { title: 'Crosscourt Consistency', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['partner', 'consistency'] },
  { title: 'Defense-Neutral-Attack Rally', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['partner', 'attack'] },
  { title: 'Serve +1 Partner', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['serve', 'partner'] },
  { title: 'Return Step-In Game', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['return', 'partner'] },
  { title: '30-30 Pressure Game', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['pressure', 'partner'], intensity: 'high' },
  { title: 'Serve Location Call', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'serve'] },
  { title: 'Partner First-Move Call', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'communication'] },
  { title: 'Poach Timing Shadow', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'net'] },
  { title: 'Middle Ball Rule', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'position'] },
  { title: 'Switch Call Drill', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles-communication', 'partner-first-move', 'decision-quality'] },
  { title: 'Doubles 30-30 Game', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'pressure'], intensity: 'high' },
  { title: 'Three-Step Reset', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['pressure', 'mental-routine', 'match-day'], identitySlugs: ['relentless-competitor-4-0'] },
  { title: 'Double-Fault Reset', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['serve', 'pressure'] },
  { title: 'Tight Arm Reset', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['pressure', 'breathing'] },
  { title: 'Closing Game Routine', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['pressure', 'match-day'] },
  { title: 'Post-Match Five-Minute Debrief', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['home', 'match-day'], equipment: ['none'], tags: ['recovery', 'match-day'] },
]

export const LEVEL_UP_CARDS: LevelUpCard[] = CARD_SEEDS.map(makeCard)

export const LEVEL_UP_MODULES: LevelUpModule[] = [
  {
    id: 'performance-upgrade-starter',
    title: 'Performance Upgrade Starter',
    subtitle: 'Body, movement, and recovery basics',
    description: 'A short off-court path for players who need legs, posture, and readiness to support their tennis goals.',
    level: 'starter',
    durationLabel: '3 cards / 20-25 minutes',
    cardIds: ['jump-rope-rhythm-builder', 'wall-sit-leg-durability', 'post-play-mobility-reset'],
    tags: ['performance-upgrade', 'at-home', 'movement'],
    identitySlugs: ['relentless-competitor-4-0'],
    proof: 'Ready body 0-5',
  },
  {
    id: 'serve-pressure-reset',
    title: 'Serve Pressure Reset',
    subtitle: 'Serve target, routine, and reset',
    description: 'A serve-focused path that connects routine reps to pressure behavior.',
    level: 'starter',
    durationLabel: '3 cards / 20 minutes',
    cardIds: ['serve-target-ladder', 'second-serve-routine-reps', 'double-fault-reset'],
    tags: ['serve', 'pressure'],
    identitySlugs: ['relentless-competitor-4-0'],
    proof: 'Serve routine under pressure 0-5',
  },
  {
    id: 'movement-engine-quick-win',
    title: 'Movement Engine Quick Win',
    subtitle: 'Light feet and recovery',
    description: 'A practical movement module for players who need cleaner first moves and recovery after contact.',
    level: 'starter',
    durationLabel: '4 cards / 25 minutes',
    cardIds: ['split-step-rhythm', 'split-recover-loop', 'cone-shuffle-finisher', 'three-step-reset'],
    tags: ['movement-engine', 'quick-win'],
    identitySlugs: ['relentless-competitor-4-0'],
    proof: 'Movement habit showed up 0-5',
  },
]

export function getRecommendedLevelUpCards(identitySlug: string, limit = 8) {
  const recommended = LEVEL_UP_CARDS
    .filter((card) => card.identitySlugs?.includes(identitySlug))
    .slice(0, limit)
  return recommended.length ? recommended : LEVEL_UP_CARDS.slice(0, limit)
}

export function getLevelUpCardsByPack(pack: string, limit = 6) {
  return LEVEL_UP_CARDS.filter((card) => card.pack === pack).slice(0, limit)
}
