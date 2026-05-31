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

function makeCard(seed: CardSeed): LevelUpCard {
  const duration = seed.durationMinutes ?? (seed.category === 'mental-routine' ? 4 : seed.category === 'mobility-stretch' ? 8 : 10)
  const level = seed.level ?? 'starter'
  const intensity = seed.intensity ?? (seed.category === 'mobility-stretch' || seed.category === 'mental-routine' ? 'low' : 'medium')
  const identitySlugs = seed.identitySlugs ?? identitySlugsFor(seed.tags)

  return {
    id: slugify(seed.title),
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
    useWhen: `Use this when ${seed.tags.includes('match-day') ? 'you are preparing for match pressure' : seed.tags.includes('recovery') ? 'your body needs a reset' : 'this skill needs focused reps'}.`,
    tennisGoal: `Build a tennis-specific ${seed.tags[0]?.replaceAll('-', ' ') ?? 'development'} habit that transfers to practice or match play.`,
    cue: seed.tags.includes('match-day') ? 'Before the next point or match block.' : 'Before the main work starts.',
    routine: buildRoutine(seed),
    reward: 'You finish with one repeatable habit and a clear proof score.',
    proof: `${seed.tags[0]?.replaceAll('-', ' ') ?? seed.title} 0-5`,
    ratingLabels: ['Cue', 'Routine', 'Reward', 'Proof'],
    progression: level === 'advanced' ? 'Add score pressure or shorter rest.' : 'Add one round or a target score when it feels clean.',
    regression: 'Cut the reps in half and keep the cue clean.',
    safetyNote: seed.category === 'strength-stability' || seed.category === 'conditioning' ? 'Stop if pain changes your movement quality.' : undefined,
    tags: seed.tags,
    identitySlugs: identitySlugs.length ? identitySlugs : undefined,
  }
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
  if (seed.category === 'partner-drill' || seed.category === 'doubles-drill') {
    return ['Set the constraint.', 'Play the rep.', 'Call the cue out loud.', 'Score the habit before changing drills.']
  }
  return ['Set the space.', 'Do 6-10 clean reps.', 'Reset posture and breathing.', 'Repeat for 3 rounds and score the proof.']
}

const CARD_SEEDS: CardSeed[] = [
  { title: 'Split-Step Rhythm', category: 'movement-engine', pack: 'Movement Engine', setting: ['home', 'court'], equipment: ['none'], tags: ['movement', 'split-step', 'light-feet'] },
  { title: 'Split + Recover Loop', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['movement', 'recovery'] },
  { title: 'Four-Cone Tennis Star', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['movement', 'cones'] },
  { title: 'Three-Cone Baseline Recover', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'baseline'] },
  { title: 'Wide-Ball Neutralizer', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'defense'] },
  { title: 'Short-Ball Close + Split', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'attack'] },
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
  { title: 'Second-Serve Routine Reps', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve', 'routine', 'pressure'] },
  { title: 'Serve +1 Shadow', category: 'serve-return', pack: 'Serve + Return', setting: ['court', 'home'], equipment: ['none'], tags: ['serve', 'attack'] },
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
