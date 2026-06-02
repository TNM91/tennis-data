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
  serve: ['relentless-competitor-4-0', 'serve-forward-finisher-4-0'],
  movement: ['relentless-competitor-4-0'],
  pressure: ['relentless-competitor-4-0'],
  conditioning: ['relentless-competitor-4-0'],
  attack: ['smart-attacker-4-0-to-4-5', 'forehand-pressure-builder-4-0'],
  doubles: ['smart-attacker-4-0-to-4-5', 'doubles-commander-4-0'],
  'doubles-communication': ['doubles-commander-4-0'],
  'partner-first-move': ['doubles-commander-4-0'],
  'poach-timing': ['doubles-commander-4-0'],
  'serve-plus-one': ['all-court-adapter-4-0', 'serve-forward-finisher-4-0', 'forehand-pressure-builder-4-0'],
  'serve-target': ['serve-forward-finisher-4-0'],
  'forward-close': ['all-court-adapter-4-0', 'serve-forward-finisher-4-0', 'forehand-pressure-builder-4-0'],
  'crosscourt-build': ['consistent-builder-4-0', 'defensive-counterpuncher-4-0', 'forehand-pressure-builder-4-0'],
  backhand: ['backhand-stability-builder-4-0'],
  'wide-ball-reset': ['consistent-builder-4-0', 'defensive-counterpuncher-4-0'],
  'defense-to-neutral': ['consistent-builder-4-0', 'defensive-counterpuncher-4-0'],
  'recovery-after-contact': ['defensive-counterpuncher-4-0'],
  'wall-work': ['consistent-builder-4-0', 'defensive-counterpuncher-4-0', 'backhand-stability-builder-4-0'],
  'pressure-reset': ['pressure-closer-4-0'],
  'return-intent': ['return-disruptor-4-0'],
  'return-recovery': ['return-disruptor-4-0'],
  'between-points': ['pressure-closer-4-0'],
  'match-day': ['consistent-builder-4-0', 'pressure-closer-4-0'],
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
  'split-step-rhythm': {
    useWhen: 'Use this before hitting or between drills when your feet are late to the ball.',
    tennisGoal: 'Make the split-step a repeatable timing habit instead of a random hop.',
    cue: 'Split as the opponent would contact, land quiet, move first step.',
    routine: ['Stand in ready position with a line or cone as your base.', 'Call split as the imaginary opponent contacts.', 'Land quietly and take one first step left or right.', 'Reset to ready and repeat 3 rounds of 10 clean reps.'],
    reward: 'You start points with a cleaner first move because your feet are timed to contact.',
    proof: 'Split-step timing and first move 0-5',
    progression: 'Add a partner point, ball toss, or random left-right call once landings stay quiet.',
    regression: 'Remove the direction change and rehearse quiet split-step landings only.',
  },
  'three-cone-baseline-recover': {
    useWhen: 'Use this when baseline shots leave you drifting or standing outside your recovery lane.',
    tennisGoal: 'Connect contact, recovery route, and ready position for repeatable rally defense.',
    cue: 'Contact, cross-step recover, ready before the next ball.',
    routine: ['Place one cone at contact and two cones for your recovery gate.', 'Shadow a forehand or backhand from the outside cone.', 'Recover through the gate and split in a balanced ready position.', 'Do 3 sets of 8 reps per side and score recovery timing.'],
    reward: 'You train the exact movement that keeps you in rallies after being pulled wide.',
    proof: 'Baseline recovery timing 0-5',
    progression: 'Add a fed ball or make the gate narrower only when the split stays balanced.',
    regression: 'Walk the route first and remove the swing until footwork is clean.',
  },
  'four-cone-tennis-star': {
    useWhen: 'Use this when first steps feel slow in multiple directions.',
    tennisGoal: 'Train short tennis movements forward, back, and lateral without turning it into random fitness.',
    cue: 'Push, stick, recover to center.',
    routine: ['Set four cones around a center ready spot.', 'Move to one cone, stick the outside foot, and return to center.', 'Split before the next direction call.', 'Run 4 rounds of 20 seconds with full-control movement.'],
    reward: 'You get quicker direction changes while still returning to a tennis-ready base.',
    proof: 'First-step control and recovery 0-5',
    safetyNote: 'Keep cone drills controlled before they get fast. Stop if cuts lose balance.',
  },
  'wall-recovery-rule': {
    useWhen: 'Use this when wall hitting turns into standing still and slapping balls.',
    tennisGoal: 'Make wall work include contact quality, recovery, and ready feet.',
    cue: 'Hit, recover behind the line, then hit again.',
    routine: ['Mark a recovery line two steps behind your contact spot.', 'Hit one controlled wall ball.', 'Recover behind the line before the next swing.', 'Run 3 blocks of 90 seconds and count clean recoveries.'],
    reward: 'You turn wall reps into rally habits that transfer to the court.',
    proof: 'Wall recovery rule completed 0-5',
    progression: 'Alternate forehand and backhand only after recovery stays honest.',
    regression: 'Catch or trap the ball between reps so the recovery rule stays clean.',
  },
  'crosscourt-consistency': {
    useWhen: 'Use this with a partner when rallies break because you change direction too early.',
    tennisGoal: 'Build shape, margin, and patience before choosing a bigger target.',
    cue: 'Heavy crosscourt first, change only after balance.',
    routine: ['Rally crosscourt with one clear height or depth target.', 'Count only balls that land crosscourt and let you recover.', 'Reset the count after a rushed line change or off-balance miss.', 'Play first team to 12 quality balls, then switch sides.'],
    reward: 'You learn to build the point before trying to finish it.',
    proof: 'Crosscourt build quality 0-5',
    progression: 'Allow one direction change after 6 quality crosscourt balls.',
    regression: 'Use cooperative pace and bigger targets until depth and recovery are consistent.',
  },
  'late-set-legs-circuit': {
    useWhen: 'Use this when your level drops late because legs, posture, or decisions fade.',
    tennisGoal: 'Practice fatigue without letting body position or point decisions collapse.',
    cue: 'Work hard, stay low, choose clearly.',
    routine: ['Do 20 seconds lateral shuffle or split-step rhythm.', 'Hold 20 seconds controlled tennis posture.', 'Shadow one serve target or rally decision.', 'Repeat 4 rounds and stop if posture quality breaks.'],
    reward: 'You connect conditioning to the exact late-match standard you want to keep.',
    proof: 'Posture and decision quality under fatigue 0-5',
    safetyNote: 'This is not max testing. Keep movement controlled and technique-first.',
  },
  'dynamic-tennis-warm-up': {
    useWhen: 'Use this before play when you need your body and attention ready for the first ball.',
    tennisGoal: 'Prepare ankles, hips, shoulders, and split-step rhythm before tennis speed arrives.',
    cue: 'Move through range, then wake up tennis feet.',
    routine: ['Start with easy skips, side shuffles, and backpedal steps.', 'Add lunges, hip openers, and arm circles without forcing range.', 'Finish with split-step plus first move reps.', 'Rate readiness before taking full-speed swings.'],
    reward: 'You enter practice with body temperature, rhythm, and first-step timing already online.',
    proof: 'Ready before play 0-5',
    safetyNote: 'Dynamic warm-up belongs before play. Keep it smooth, not exhausting.',
  },
  'dead-bug-serve-shadow': {
    useWhen: 'Use this when your serve loses posture, ribs flare, or the toss arm and core feel disconnected.',
    tennisGoal: 'Connect core control to a quieter serve setup before adding speed.',
    cue: 'Ribs quiet, breath steady, serve shape smooth.',
    routine: ['Do 6 slow dead bugs each side with steady breathing.', 'Stand and shadow one slow serve motion.', 'Pause at trophy and finish balanced.', 'Repeat 3 rounds and score whether posture stayed quiet.'],
    reward: 'Your serve prep gets a core-control check instead of random ab work.',
    proof: 'Core control for serve rhythm 0-5',
    progression: 'Add a towel serve flow after each set when posture stays quiet.',
    regression: 'Shorten the leg reach and keep the back position controlled.',
    safetyNote: 'Technique first. Stop if pain changes posture or breathing.',
  },
  'band-external-rotation': {
    useWhen: 'Use this before serve work or strength blocks when shoulders need controlled activation.',
    tennisGoal: 'Build shoulder control that supports serve rhythm without chasing heavy resistance.',
    cue: 'Elbow quiet, shoulder blade set, smooth rotation.',
    routine: ['Anchor a light band at elbow height.', 'Keep elbow near the side and rotate slowly out.', 'Do 2 sets of 8-12 controlled reps each side.', 'Shadow two relaxed serves and score shoulder control.'],
    reward: 'You prepare the shoulder for cleaner serve reps without turning warm-up into max effort.',
    proof: 'Shoulder control for serve rhythm 0-5',
    progression: 'Add a slow towel serve after each set when control stays smooth.',
    regression: 'Use no band and rehearse the rotation path with posture first.',
    safetyNote: 'Use light resistance. The goal is control, not max loading.',
  },
  'second-serve-routine-reps': {
    useWhen: 'Use this when second serves get rushed, tentative, or emotionally tied to the last miss.',
    tennisGoal: 'Make the second serve routine repeatable under small pressure.',
    cue: 'Same breath, same target, committed shape.',
    routine: ['Start every rep with one breath and a called target.', 'Hit or shadow 8 second serves with the same tempo.', 'After any miss, run the full routine before the next ball.', 'Play 3 rounds and score routine commitment, not just makes.'],
    reward: 'Second serves become a repeatable process instead of a panic swing.',
    proof: 'Second-serve routine commitment 0-5',
    progression: 'Start each round at 30-40 once the routine stays stable.',
    regression: 'Shadow the serve path and target call before adding the ball.',
  },
  'basket-forehand-crosscourt': {
    useWhen: 'Use this when forehand reps get big, flat, or disconnected from recovery.',
    tennisGoal: 'Build a crosscourt forehand that creates margin and lets you recover before attacking.',
    cue: 'Shape crosscourt, finish balanced, recover through the lane.',
    routine: ['Set a crosscourt target with margin inside the sideline.', 'Feed or self-drop 8 forehands with height over the net.', 'Recover to a ready cone after every shot.', 'Run 3 rounds and count only balls with shape plus recovery.'],
    reward: 'Your forehand practice starts producing rally patterns, not isolated swings.',
    proof: 'Forehand crosscourt shape and recovery 0-5',
    progression: 'Add a plus-one target after 6 quality crosscourt balls.',
    regression: 'Use slower self-feeds and make the target bigger until balance holds.',
  },
  'defense-neutral-attack-rally': {
    useWhen: 'Use this with a partner when you either defend forever or attack too early.',
    tennisGoal: 'Learn to recognize defense, neutral, and offense before choosing the next ball.',
    cue: 'Defend with height, build neutral, attack from balance.',
    routine: ['Partner feeds one defensive ball to start the rally.', 'Player must hit one high neutral ball before attacking.', 'Only attack when balanced and inside the court.', 'Play to 7 points and score decision quality after each point.'],
    reward: 'You train shot selection instead of treating every ball like the same opportunity.',
    proof: 'Defense-neutral-attack decision quality 0-5',
    progression: 'Add a smaller attack target when the neutral ball is reliable.',
    regression: 'Remove scoring and make the partner feed cooperative.',
  },
  'serve-1-partner': {
    useWhen: 'Use this with a partner when your serve does not create a clear next-ball plan.',
    tennisGoal: 'Connect serve location to the first ball you expect to play.',
    cue: 'Serve location, recover, plus-one target.',
    routine: ['Call the serve location before the motion.', 'Partner returns cooperatively to the planned zone.', 'Hit the plus-one ball to the named target.', 'Rotate after 8 reps and score serve plus-one clarity.'],
    reward: 'The serve becomes the start of a pattern instead of a standalone shot.',
    proof: 'Serve plus-one clarity with partner 0-5',
    progression: 'Make the return less cooperative after three clean patterns.',
    regression: 'Shadow serve plus-one without the ball until the pattern is clear.',
  },
  '30-30-pressure-game': {
    useWhen: 'Use this when practice points feel fine but pressure points change your routine.',
    tennisGoal: 'Practice starting points at pressure scores while keeping the same cue and target choices.',
    cue: 'Score is loud, routine stays quiet.',
    routine: ['Start every game at 30-30.', 'Before each point, say the plan in five words or fewer.', 'Play the point and reset immediately after it ends.', 'Play best of 5 games and score routine discipline.'],
    reward: 'You get pressure reps that reveal whether the habit survives when the score matters.',
    proof: 'Routine discipline at 30-30 0-5',
    progression: 'Start return games at 30-40 or serve games at deuce when routine holds.',
    regression: 'Play cooperative points but keep the pressure-score routine.',
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
  'return-shadow-split-read': {
    useWhen: 'Use this before return practice when the split, read, or first move feels late.',
    tennisGoal: 'Build the habit of choosing a return job before the toss and splitting on the server contact rhythm.',
    cue: 'Job early, split on contact, recover after the swing.',
    routine: ['Stand in return position and call block, drive, height, or depth.', 'Shadow the split-step as the imaginary server contacts.', 'Shadow the return shape with a short recovery step.', 'Run 3 rounds of 8 reps and score whether the job was chosen early.'],
    reward: 'You rehearse the return decision before the ball is moving too fast to think.',
    proof: 'Return job chosen before toss 0-5',
    progression: 'Add a partner toss, serve shadow, or live serve once the job and split are on time.',
    regression: 'Remove the swing and rehearse call, split, and first step only.',
  },
  'return-depth-lane': {
    useWhen: 'Use this with a server or feeder when returns land short or float without a plan.',
    tennisGoal: 'Train a clear return shape that lands deep enough to start the point neutral.',
    cue: 'Deep lane first, recover before judging.',
    routine: ['Choose one return lane: crosscourt deep, middle deep, or high neutral.', 'Server or feeder gives 8 controlled serves or feeds.', 'Return to the named lane and recover to ready after contact.', 'Repeat 3 rounds and count only returns with lane plus recovery.'],
    reward: 'You get a return that starts the point instead of only surviving the serve.',
    proof: 'Return depth lane and recovery 0-5',
    progression: 'Let the server vary location after the lane and recovery hold for two rounds.',
    regression: 'Use cooperative feeds and a bigger target until depth is repeatable.',
  },
  'second-serve-attack-or-build': {
    useWhen: 'Use this when second serves create rushed attacks or passive returns.',
    tennisGoal: 'Decide before the serve whether the second-serve return is an attack, build, or neutral start.',
    cue: 'Name attack, build, or neutral before the toss.',
    routine: ['Before each second serve, call attack, build, or neutral.', 'Return with the called shape instead of reacting late.', 'Play only the return plus one ball, then reset.', 'Run 3 rounds of 6 points and score decision quality.'],
    reward: 'You stop treating every second serve the same and start using the right return for the ball.',
    proof: 'Second-serve return decision 0-5',
    progression: 'Add score pressure at 30-30 once the decision happens before the toss.',
    regression: 'Use hand-fed second-serve looks and call the job before contact.',
  },
  'wall-return-recovery': {
    useWhen: 'Use this when you are alone with a wall and want return reps that include footwork.',
    tennisGoal: 'Rehearse compact return contact, recovery, and ready position without a server.',
    cue: 'Short swing, recover line, ready again.',
    routine: ['Mark a return contact spot and a recovery line.', 'Feed the wall with a short compact return swing.', 'Recover behind the line before the next contact.', 'Run 4 blocks of 45 seconds and score compact contact plus recovery.'],
    reward: 'You turn solo wall work into a return habit instead of random hitting.',
    proof: 'Wall return contact and recovery 0-5',
    progression: 'Alternate forehand and backhand returns when recovery stays honest.',
    regression: 'Catch or trap the ball between reps and rehearse the recovery line.',
  },
  'return-plus-one-recover': {
    useWhen: 'Use this when the return is playable but the next ball catches you standing.',
    tennisGoal: 'Connect return contact to the first recovery and first move after the return.',
    cue: 'Return, recover, first move.',
    routine: ['Server hits a controlled serve or feeder simulates a serve.', 'Player returns to the named zone.', 'Player recovers and plays one plus-one ball.', 'Stop after the plus-one and score recovery before the second ball.'],
    reward: 'You practice the whole return start, not just making the serve back.',
    proof: 'Return plus-one recovery 0-5',
    progression: 'Play the point live after the plus-one once recovery happens automatically.',
    regression: 'Shadow the plus-one ball after the return before playing it live.',
  },
  'return-30-30-game': {
    useWhen: 'Use this when return choices change under pressure scores.',
    tennisGoal: 'Practice return intent, reset, and recovery at pressure starts.',
    cue: 'Pressure score, clear return job.',
    routine: ['Start every return game at 30-30.', 'Before each return, call the job: block, drive, height, depth, or attack.', 'Play the point and reset before discussing it.', 'Play best of 5 games and score whether the return job stayed clear.'],
    reward: 'You learn whether your return plan survives when the score matters.',
    proof: 'Return intent at 30-30 0-5',
    progression: 'Start at 30-40 or break point after the return job stays clear.',
    regression: 'Play cooperative return points but keep the pressure score and job call.',
  },
  'doubles-return-first-move': {
    useWhen: 'Use this in doubles when the returner and partner are not aligned before the serve.',
    tennisGoal: 'Make the return direction and partner first move clear before the serve starts.',
    cue: 'Return lane called, partner move called.',
    routine: ['Returner calls crosscourt, middle, lob, or line before the serve.', 'Partner calls hold, close, fake, or switch.', 'Play the return plus one ball.', 'Score whether both players moved with the call.'],
    reward: 'The return game starts with shared information instead of both players guessing.',
    proof: 'Doubles return first-move clarity 0-5',
    progression: 'Play the full point once the first move is clear for two rounds.',
    regression: 'Shadow the return and partner move without a live serve first.',
  },
  'double-fault-reset': {
    useWhen: 'Use this after double faults or when one missed serve starts affecting the next point.',
    tennisGoal: 'Separate the last serve from the next serve plan.',
    cue: 'Turn away, breathe, choose the next target.',
    routine: ['After a double fault or shadow miss, turn away from the baseline.', 'Take one slow breath and loosen the hand.', 'Call the next serve target and shape.', 'Step back in only after the plan is clear.'],
    reward: 'You train the response to a bad serve, not just the serve itself.',
    proof: 'Double-fault reset used 0-5',
    progression: 'Use it during a 30-30 serve game and score whether the next routine stayed intact.',
    regression: 'Practice the reset without serving until it feels automatic.',
  },
  'tight-arm-reset': {
    useWhen: 'Use this when pressure makes your grip, arm, or breathing tighten.',
    tennisGoal: 'Lower tension before the next point so the swing can stay playable.',
    cue: 'Exhale, soften the hand, swing to shape.',
    routine: ['Step behind the baseline or away from the rally lane.', 'Exhale longer than the inhale.', 'Open and close the hitting hand once.', 'Name the next shape: height, depth, or target.'],
    reward: 'You get a quick pressure release that fits between points.',
    proof: 'Tension reset before next ball 0-5',
    progression: 'Use it after every miss in a pressure game until it is automatic.',
    regression: 'Use the breathing and hand release before practice reps first.',
  },
  'split-squat-control': {
    useWhen: 'Use this when your legs need strength that still looks like tennis posture.',
    tennisGoal: 'Build single-leg control for wider balls, recovery steps, and lower contact positions.',
    cue: 'Tall chest, quiet knee, push through the whole foot.',
    routine: ['Set up in a split stance with room to balance.', 'Lower slowly for 5-6 controlled reps each side.', 'Stand, reset posture, and shadow one recovery step.', 'Repeat 2-3 sets and score control, not burn.'],
    reward: 'You connect lower-body strength to staying balanced when the court pulls you wide.',
    proof: 'Split squat control for tennis posture 0-5',
    progression: 'Add a pause at the bottom only when knee and posture stay quiet.',
    regression: 'Hold a chair or shorten the range until control is clean.',
    safetyNote: 'Technique first. Stop if pain changes knee, hip, or posture quality.',
  },
  'reverse-lunge-recover': {
    useWhen: 'Use this when recovery steps get tall, slow, or off-balance.',
    tennisGoal: 'Train a controlled decel and push back to ready position.',
    cue: 'Step back, load, recover forward with balance.',
    routine: ['Step back into a controlled reverse lunge.', 'Pause with chest tall and front foot stable.', 'Push back to ready and shadow a split step.', 'Do 2 sets of 6 each side and score recovery balance.'],
    reward: 'You build the leg control needed to stop, reload, and move again during rallies.',
    proof: 'Lunge-to-recover balance 0-5',
    progression: 'Add a shadow forehand or backhand after each recovery step.',
    regression: 'Use a smaller step and remove the split until balance holds.',
    safetyNote: 'Keep reps controlled. Do not chase depth if posture changes.',
  },
  'lateral-lunge-shadow': {
    useWhen: 'Use this when wide-ball movement feels stiff or late.',
    tennisGoal: 'Build side-to-side loading that supports wide-ball defense and recovery.',
    cue: 'Load outside leg, stay tall, recover before watching.',
    routine: ['Step into a lateral lunge with the outside foot planted.', 'Keep the inside leg long and posture controlled.', 'Push back to center and shadow a neutral crosscourt ball.', 'Run 2 sets of 6 each side and score wide-ball posture.'],
    reward: 'You practice the body shape needed to defend wide without collapsing.',
    proof: 'Wide-ball body control 0-5',
    progression: 'Add a cone target and recover through it after each shadow swing.',
    regression: 'Reduce range and move slower until the outside-leg load is clean.',
    safetyNote: 'Choose control before range. Stop if pain changes movement.',
  },
  'step-up-split': {
    useWhen: 'Use this when first-step timing fades as your legs get tired.',
    tennisGoal: 'Connect leg drive to a quiet split-step landing.',
    cue: 'Step up strong, land quiet, split ready.',
    routine: ['Use a stable low step or bench.', 'Step up with control and stand tall.', 'Step down, land quietly, and split into ready position.', 'Do 2 sets of 6 each side and score landing control.'],
    reward: 'You build leg drive without losing the soft landing you need on court.',
    proof: 'Step-up to split-step control 0-5',
    progression: 'Add a left-right first move call after the split.',
    regression: 'Use a lower step or remove the split until landing stays quiet.',
    safetyNote: 'Use a stable surface and keep the step height technique-first.',
  },
  'pallof-press': {
    useWhen: 'Use this when rotation work needs to support balance, not just core fatigue.',
    tennisGoal: 'Build anti-rotation control for serve, return, and open-stance shots.',
    cue: 'Brace softly, press straight, do not rotate.',
    routine: ['Anchor a light band at chest height.', 'Stand athletic with the band pulling from one side.', 'Press straight out for 6-8 reps without turning.', 'Shadow one serve or return position and score trunk control.'],
    reward: 'You train the core to keep the body organized while the swing rotates around it.',
    proof: 'Anti-rotation control for tennis posture 0-5',
    progression: 'Add a split stance or slow shadow swing after each set.',
    regression: 'Move closer to the anchor or use a lighter band.',
    safetyNote: 'Use light resistance and controlled breathing. No max holds.',
  },
  'return-1-conditioning': {
    useWhen: 'Use this when return games start sharp but your first move fades after a few points.',
    tennisGoal: 'Condition return recovery without losing intent or ready position.',
    cue: 'Return job, recover, first move again.',
    routine: ['Partner feeds or serves 6 return starts.', 'Call the return job before each ball: block, drive, or height.', 'Recover to ready immediately after contact.', 'Rest, repeat 3 rounds, and score return intent under fatigue.'],
    reward: 'You practice staying organized through repeated return starts, not just one good swing.',
    proof: 'Return intent under fatigue 0-5',
    progression: 'Start each round at 30-30 once recovery stays clean.',
    regression: 'Use hand-fed balls and slower pace until return job and recovery both hold.',
  },
  'wall-rally-rhythm': {
    useWhen: 'Use this when you need useful solo hitting without drifting into random wall slaps.',
    tennisGoal: 'Build repeatable contact rhythm with a recovery habit between hits.',
    cue: 'Smooth contact, small reset, same height window.',
    routine: ['Choose one height window on the wall.', 'Hit 30 seconds of controlled forehands or backhands.', 'Reset the feet after every hit instead of standing still.', 'Run 4 blocks and score rhythm plus recovery.'],
    reward: 'You turn the wall into a rhythm and footwork tool.',
    proof: 'Wall rhythm with foot reset 0-5',
    progression: 'Alternate forehand and backhand when the height window stays steady.',
    regression: 'Shorten the block to 15 seconds and catch/reset between reps.',
  },
  'wall-depth-builder': {
    useWhen: 'Use this when your rally ball lacks height, depth, or repeatable shape.',
    tennisGoal: 'Use wall contact to rehearse a safer rally shape before going back to court.',
    cue: 'Lift through the target, finish balanced, recover.',
    routine: ['Mark a wall target above net height.', 'Hit 10 balls aiming for shape, not speed.', 'Recover one step after each contact.', 'Do 3 rounds and count balls that meet height plus balance.'],
    reward: 'You practice the ball shape that keeps you in points.',
    proof: 'Wall depth shape and recovery 0-5',
    progression: 'Add alternating targets once height and balance hold.',
    regression: 'Move closer and slow the swing until shape is repeatable.',
  },
  'wall-alternating-fh-bh': {
    useWhen: 'Use this when switching sides creates rushed contact or late feet.',
    tennisGoal: 'Train side-change footwork and contact spacing without needing a partner.',
    cue: 'Recover center, turn early, hit the next side.',
    routine: ['Hit one forehand, recover, then one backhand.', 'Keep the ball speed slow enough to move the feet first.', 'Count clean pairs only when both contacts are balanced.', 'Do 3 rounds of 8 pairs and score transition quality.'],
    reward: 'You build a simple solo pattern for changing sides without panic.',
    proof: 'Forehand-backhand transition quality 0-5',
    progression: 'Add a smaller recovery target when transitions stay clean.',
    regression: 'Catch or trap the ball between sides and rehearse the turn first.',
  },
  'serve-location-call': {
    useWhen: 'Use this in doubles when the server and partner are not aligned before the point.',
    tennisGoal: 'Make serve location visible so the partner knows the first move.',
    cue: 'Location call creates partner movement.',
    routine: ['Server calls wide, body, or T before the point.', 'Partner says first move: hold, fake, poach, or protect line.', 'Play the point with that plan.', 'After each game, score whether the call changed partner readiness.'],
    reward: 'Your doubles team starts points with a shared picture instead of guessing.',
    proof: 'Serve location and partner readiness 0-5',
    progression: 'Add a planned poach after two clear location calls.',
    regression: 'Rehearse the calls without playing the point first.',
  },
  'poach-timing-shadow': {
    useWhen: 'Use this when poaches are late, obvious, or disconnected from the serve.',
    tennisGoal: 'Train the first move and timing of a poach before using it live.',
    cue: 'Read the toss, split, cross on the return swing.',
    routine: ['Start in net-player ready position.', 'Partner or coach calls serve direction.', 'Split and shadow the poach path across the middle.', 'Repeat 3 sets of 6 and score timing, not speed.'],
    reward: 'You get a cleaner first move for doubles pressure without gambling blindly.',
    proof: 'Poach timing and first move 0-5',
    progression: 'Add a live return feed after timing stays controlled.',
    regression: 'Walk the poach path and call the trigger out loud.',
  },
  'volley-ready-split': {
    useWhen: 'Use this when volleys feel rushed because the player arrives at net without a ready split.',
    tennisGoal: 'Train the split, quiet hands, and first volley decision before the ball reaches the player.',
    cue: 'Close, split, quiet hands.',
    routine: ['Start two steps inside the service line.', 'Shadow a close and split before the feeder toss.', 'Volley or shadow to the named target.', 'Run 3 rounds of 8 reps and count only split plus target.'],
    reward: 'You arrive at net ready to make a calm first volley instead of swinging late.',
    proof: 'Volley ready split 0-5',
    progression: 'Add a live feed to either side after the split and target stay clear.',
    regression: 'Remove the ball and rehearse close, split, target call only.',
  },
  'volley-punch-target': {
    useWhen: 'Use this when volleys float, swing too much, or miss because the target is unclear.',
    tennisGoal: 'Build a compact volley punch with a target before contact.',
    cue: 'Target first, punch short, recover forward.',
    routine: ['Choose deep middle, short angle, or behind the player.', 'Partner feeds 8 controlled volleys.', 'Punch to the called target and recover one step forward.', 'Repeat 3 rounds and score target plus compact contact.'],
    reward: 'You get a volley that has a job instead of just blocking the ball back.',
    proof: 'Volley target and compact contact 0-5',
    progression: 'Let the feeder vary forehand and backhand volleys once contact stays compact.',
    regression: 'Use hand feeds and a bigger target until the swing stays short.',
  },
  'approach-volley-close': {
    useWhen: 'Use this when the approach shot is fine but the first volley is late or off balance.',
    tennisGoal: 'Connect approach, close, split, and first volley into one net pattern.',
    cue: 'Approach, close, split, first volley.',
    routine: ['Feed or self-drop an approach ball to a safe target.', 'Close behind the approach and split before the feed.', 'Play one volley to the named target.', 'Stop after the volley and score whether the close and split happened.'],
    reward: 'You practice finishing forward, not just hitting an approach and watching.',
    proof: 'Approach-volley connection 0-5',
    progression: 'Play the point live after the first volley once the close and split are automatic.',
    regression: 'Shadow the approach and close before adding a live volley feed.',
  },
  'reaction-volley-wall': {
    useWhen: 'Use this alone with a wall when volley hands need rhythm without big swings.',
    tennisGoal: 'Train short volley contact, quick reset, and balanced hands with a wall.',
    cue: 'Short block, reset hands, stay balanced.',
    routine: ['Stand close enough that big swings are impossible.', 'Volley softly to the wall for 20-30 seconds.', 'Reset the hands in front after every touch.', 'Run 4 blocks and score compact hands plus balance.'],
    reward: 'You build net touch and readiness without needing a partner.',
    proof: 'Reaction volley hands 0-5',
    progression: 'Alternate forehand and backhand volleys when balance stays quiet.',
    regression: 'Catch the ball between touches and reset the hands before the next volley.',
  },
  'middle-ball-rule': {
    useWhen: 'Use this when doubles partners hesitate or both reach for the same middle ball.',
    tennisGoal: 'Create a shared middle-ball rule that reduces confusion under pressure.',
    cue: 'Call mine, yours, or switch early.',
    routine: ['Agree on the middle-ball rule before the point.', 'Play points where middle balls must be called early.', 'Pause after confusion and restate the rule.', 'Play first team to 7 clear-call points.'],
    reward: 'Your team gets a simple decision rule for one of the messiest doubles moments.',
    proof: 'Middle-ball decision clarity 0-5',
    progression: 'Add poach and switch calls once middle ownership is clear.',
    regression: 'Use cooperative feeds through the middle before playing live points.',
  },
  'switch-call-drill': {
    useWhen: 'Use this when lobs, wide balls, or defensive scrambles break doubles communication.',
    tennisGoal: 'Practice early switch calls so both players move before the ball becomes emergency.',
    cue: 'Call early, move first, explain later.',
    routine: ['Partner feeds a lob or wide ball that forces movement.', 'Player calls switch, stay, or help before chasing.', 'Both players recover to the correct court spots.', 'Run 10 reps and score whether the call came early enough.'],
    reward: 'You train the communication that keeps doubles defense organized.',
    proof: 'Switch call timing 0-5',
    progression: 'Play the point out after the switch when calls are early.',
    regression: 'Walk through the positions without the ball first.',
  },
  'doubles-30-30-game': {
    useWhen: 'Use this when doubles communication disappears on big points.',
    tennisGoal: 'Keep serve/return plans and partner calls clear at pressure scores.',
    cue: 'Plan before point, call during point, reset after point.',
    routine: ['Start every game at 30-30.', 'Each team must call serve/return plan before the point.', 'After the point, name one communication win or miss.', 'Play best of 5 games and score clarity under pressure.'],
    reward: 'Your team gets pressure practice with communication as the main scoreboard.',
    proof: 'Doubles clarity at 30-30 0-5',
    progression: 'Require a first-move call before every serve and return.',
    regression: 'Start at 15-15 and use cooperative serves until calls are clean.',
  },
  'closing-game-routine': {
    useWhen: 'Use this when closing games makes you rush, protect, or change your identity.',
    tennisGoal: 'Use the same plan language when the game is almost finished.',
    cue: 'Same player, clear target, next point only.',
    routine: ['Pick one closing cue before the game starts.', 'At 30-all or later, say the cue and target before each point.', 'After every point, turn away and reset.', 'Score whether the routine stayed the same as pressure rose.'],
    reward: 'You practice closing as a repeatable habit, not a personality test.',
    proof: 'Closing routine stayed clear 0-5',
    progression: 'Start practice games at 30-30 or deuce.',
    regression: 'Use the routine in cooperative points before scoring.',
  },
  'post-match-five-minute-debrief': {
    useWhen: 'Use this after a match before the story gets too big or too emotional.',
    tennisGoal: 'Turn match experience into one next practice action.',
    cue: 'One proof, one leak, one next rep.',
    routine: ['Write one thing that worked and where it showed up.', 'Write one pattern that cost points.', 'Choose one Level Up card for the next session.', 'Stop after five minutes and send only the useful note if sharing.'],
    reward: 'You leave the match with a next action instead of a long recap.',
    proof: 'Post-match next action clarity 0-5',
    progression: 'Compare this note with your next practice proof score.',
    regression: 'Use only three words: worked, leaked, next.',
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
  { title: 'Cone Recover + Shadow Swing', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['recovery-after-contact', 'recover-before-watching', 'shadow-swing', 'cones', 'light-feet'], identitySlugs: ['relentless-competitor-4-0', 'defensive-counterpuncher-4-0'] },
  { title: 'Four-Cone Tennis Star', category: 'movement-engine', pack: 'Movement Engine', setting: ['court', 'driveway'], equipment: ['cones'], tags: ['movement', 'cones'] },
  { title: 'Three-Cone Baseline Recover', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'baseline'] },
  { title: 'Wide-Ball Neutralizer', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'defense', 'wide-ball-reset', 'defense-to-neutral'], identitySlugs: ['relentless-competitor-4-0', 'consistent-builder-4-0', 'defensive-counterpuncher-4-0', 'all-court-adapter-4-0'] },
  { title: 'Short-Ball Close + Split', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['movement', 'attack', 'forward-close', 'decision-quality'], identitySlugs: ['smart-attacker-4-0-to-4-5', 'serve-forward-finisher-4-0', 'all-court-adapter-4-0'] },
  { title: 'Cone Close + Recover', category: 'movement-engine', pack: 'Movement Engine', setting: ['court'], equipment: ['cones'], tags: ['forward-close', 'attack-balance', 'recovery-after-contact', 'cones'], identitySlugs: ['smart-attacker-4-0-to-4-5', 'serve-forward-finisher-4-0'] },
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
  { title: 'Wall Sit Leg Durability', category: 'strength-stability', pack: 'Lower-Body Strength & Leg Durability', setting: ['home', 'garage', 'gym'], equipment: ['wall'], tags: ['conditioning', 'leg-durability'], identitySlugs: ['relentless-competitor-4-0', 'defensive-counterpuncher-4-0'] },
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
  { title: 'Five-Minute Match Primer', category: 'match-prep', pack: 'Mobility Reset + Stretches', setting: ['court', 'match-day'], equipment: ['none'], tags: ['match-day', 'warm-up'], identitySlugs: ['pressure-closer-4-0'] },
  { title: 'Worlds Greatest Stretch', category: 'mobility-stretch', pack: 'Mobility Reset + Stretches', setting: ['home', 'court'], equipment: ['none'], tags: ['mobility', 'stretch'] },
  { title: 'Thoracic Open Book', category: 'mobility-stretch', pack: 'Mobility Reset + Stretches', setting: ['home'], equipment: ['none'], tags: ['mobility', 'recovery'] },
  { title: 'Post-Play Mobility Reset', category: 'recovery-reset', pack: 'Recovery Mode', setting: ['home', 'court', 'match-day'], equipment: ['none'], tags: ['recovery', 'mobility'], identitySlugs: ['relentless-competitor-4-0', 'consistent-builder-4-0', 'defensive-counterpuncher-4-0'] },
  { title: 'Wall Rally Rhythm', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'rhythm'] },
  { title: 'Wall Depth Builder', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'wall-work', 'depth', 'crosscourt-build'], identitySlugs: ['consistent-builder-4-0', 'defensive-counterpuncher-4-0', 'backhand-stability-builder-4-0'] },
  { title: 'Wall Recovery Rule', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'recovery'] },
  { title: 'Wall Alternating FH/BH', category: 'solo-drill', pack: 'Wall + Shadow Work', setting: ['wall'], equipment: ['wall'], tags: ['wall', 'wall-work', 'strokes', 'crosscourt-build'], identitySlugs: ['consistent-builder-4-0', 'defensive-counterpuncher-4-0', 'backhand-stability-builder-4-0'] },
  { title: 'Cue Phrase Shadow', category: 'mental-routine', pack: 'Wall + Shadow Work', setting: ['home', 'court'], equipment: ['none'], tags: ['mental-routine', 'cue'] },
  { title: 'Serve Target Ladder', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve', 'serve-target', 'target'], identitySlugs: ['relentless-competitor-4-0', 'serve-forward-finisher-4-0'] },
  { title: 'Serve Target Call', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve-routine', 'serve-target', 'decision-quality'], identitySlugs: ['relentless-competitor-4-0', 'serve-forward-finisher-4-0'] },
  { title: 'Second-Serve Routine Reps', category: 'serve-return', pack: 'Serve + Return', setting: ['court'], equipment: ['basket'], tags: ['serve', 'routine', 'pressure'] },
  { title: 'Serve +1 Shadow', category: 'serve-return', pack: 'Serve + Return', setting: ['court', 'home'], equipment: ['none'], tags: ['serve', 'attack', 'serve-plus-one', 'decision-quality'], identitySlugs: ['smart-attacker-4-0-to-4-5', 'serve-forward-finisher-4-0', 'all-court-adapter-4-0'] },
  { title: 'Return Shadow Split Read', category: 'serve-return', pack: 'Serve + Return', setting: ['home', 'court'], equipment: ['none'], tags: ['return-intent', 'split-step', 'shadow-swing', 'quick-win'], identitySlugs: ['relentless-competitor-4-0', 'return-disruptor-4-0'] },
  { title: 'Return Depth Lane', category: 'partner-drill', pack: 'Serve + Return', setting: ['court'], equipment: ['partner'], tags: ['return-intent', 'return-recovery', 'decision-quality'], identitySlugs: ['smart-attacker-4-0-to-4-5', 'return-disruptor-4-0', 'backhand-stability-builder-4-0', 'all-court-adapter-4-0'] },
  { title: 'Second-Serve Attack or Build', category: 'partner-drill', pack: 'Serve + Return', setting: ['court'], equipment: ['partner'], tags: ['return-intent', 'attack-balance', 'decision-quality'], identitySlugs: ['return-disruptor-4-0'] },
  { title: 'Wall Return Recovery', category: 'solo-drill', pack: 'Serve + Return', setting: ['wall'], equipment: ['wall'], tags: ['return-recovery', 'wall-work', 'first-step'], identitySlugs: ['return-disruptor-4-0'] },
  { title: 'Return Plus-One Recover', category: 'partner-drill', pack: 'Serve + Return', setting: ['court'], equipment: ['partner'], tags: ['return-recovery', 'first-step', 'decision-quality'], identitySlugs: ['return-disruptor-4-0'] },
  { title: 'Return 30-30 Game', category: 'partner-drill', pack: 'Serve + Return', setting: ['court'], equipment: ['partner'], tags: ['return-intent', 'pressure-reset', 'between-points'], intensity: 'high', identitySlugs: ['pressure-closer-4-0', 'return-disruptor-4-0'] },
  { title: 'Recover Before Score', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['recover-before-watching', 'recovery-after-contact', 'between-points', 'quick-win'], identitySlugs: ['relentless-competitor-4-0', 'defensive-counterpuncher-4-0', 'backhand-stability-builder-4-0'] },
  { title: 'Basket Forehand Crosscourt', category: 'solo-drill', pack: 'Solo Court Drills', setting: ['court'], equipment: ['basket'], tags: ['attack', 'forehand', 'crosscourt-build'], identitySlugs: ['smart-attacker-4-0-to-4-5', 'consistent-builder-4-0', 'all-court-adapter-4-0'] },
  { title: 'Basket Backhand Crosscourt', category: 'solo-drill', pack: 'Solo Court Drills', setting: ['court'], equipment: ['basket'], tags: ['strokes', 'backhand', 'crosscourt-build'], identitySlugs: ['consistent-builder-4-0', 'defensive-counterpuncher-4-0', 'backhand-stability-builder-4-0', 'all-court-adapter-4-0'] },
  { title: 'Pressure Basket', category: 'solo-drill', pack: 'Solo Court Drills', setting: ['court'], equipment: ['basket'], tags: ['pressure', 'basket'] },
  { title: 'Crosscourt Consistency', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['partner', 'consistency', 'crosscourt-build', 'decision-quality'], identitySlugs: ['consistent-builder-4-0', 'smart-attacker-4-0-to-4-5', 'defensive-counterpuncher-4-0', 'forehand-pressure-builder-4-0', 'backhand-stability-builder-4-0', 'all-court-adapter-4-0'] },
  { title: 'Defense-Neutral-Attack Rally', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['partner', 'attack', 'decision-quality', 'defense-to-neutral'], identitySlugs: ['defensive-counterpuncher-4-0', 'all-court-adapter-4-0', 'smart-attacker-4-0-to-4-5'] },
  { title: 'Serve +1 Partner', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['serve', 'serve-plus-one', 'partner'], identitySlugs: ['smart-attacker-4-0-to-4-5', 'serve-forward-finisher-4-0'] },
  { title: 'Return Step-In Game', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['return', 'partner'] },
  { title: '30-30 Pressure Game', category: 'partner-drill', pack: 'Partner Drills', setting: ['court'], equipment: ['partner'], tags: ['pressure', 'partner'], intensity: 'high' },
  { title: 'Serve Location Call', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'serve', 'serve-target', 'partner-first-move'], identitySlugs: ['doubles-commander-4-0', 'smart-attacker-4-0-to-4-5'] },
  { title: 'Doubles Return First Move', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles-communication', 'return-intent', 'partner-first-move'], identitySlugs: ['doubles-commander-4-0', 'return-disruptor-4-0'] },
  { title: 'Partner First-Move Call', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'doubles-communication', 'communication', 'partner-first-move'], identitySlugs: ['doubles-commander-4-0'] },
  { title: 'Poach Timing Shadow', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'net', 'poach-timing', 'partner-first-move'], identitySlugs: ['doubles-commander-4-0', 'smart-attacker-4-0-to-4-5'] },
  { title: 'Volley Ready Split', category: 'partner-drill', pack: 'Net + Volley Tools', setting: ['court'], equipment: ['partner'], tags: ['volley', 'split-step', 'forward-close', 'quick-win'], identitySlugs: ['serve-forward-finisher-4-0'] },
  { title: 'Volley Punch Target', category: 'partner-drill', pack: 'Net + Volley Tools', setting: ['court'], equipment: ['partner'], tags: ['volley', 'decision-quality', 'forward-close'], identitySlugs: ['serve-forward-finisher-4-0'] },
  { title: 'Approach Volley Close', category: 'partner-drill', pack: 'Net + Volley Tools', setting: ['court'], equipment: ['partner'], tags: ['volley', 'forward-close', 'attack-balance', 'decision-quality'], identitySlugs: ['all-court-adapter-4-0', 'smart-attacker-4-0-to-4-5', 'serve-forward-finisher-4-0'] },
  { title: 'Reaction Volley Wall', category: 'solo-drill', pack: 'Net + Volley Tools', setting: ['wall'], equipment: ['wall'], tags: ['volley', 'wall-work', 'balance'] },
  { title: 'Middle Ball Rule', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'position', 'doubles-communication', 'decision-quality'], identitySlugs: ['doubles-commander-4-0'] },
  { title: 'Switch Call Drill', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles-communication', 'partner-first-move', 'decision-quality'], identitySlugs: ['doubles-commander-4-0'] },
  { title: 'Doubles 30-30 Game', category: 'doubles-drill', pack: 'Doubles Tools', setting: ['court'], equipment: ['partner'], tags: ['doubles', 'pressure', 'pressure-reset', 'doubles-communication'], intensity: 'high', identitySlugs: ['doubles-commander-4-0'] },
  { title: 'Three-Step Reset', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['pressure', 'mental-routine', 'match-day', 'pressure-reset'], identitySlugs: ['relentless-competitor-4-0', 'consistent-builder-4-0', 'serve-forward-finisher-4-0', 'defensive-counterpuncher-4-0', 'pressure-closer-4-0', 'backhand-stability-builder-4-0', 'all-court-adapter-4-0'] },
  { title: 'Double-Fault Reset', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['serve', 'pressure', 'pressure-reset'], identitySlugs: ['relentless-competitor-4-0', 'serve-forward-finisher-4-0', 'pressure-closer-4-0'] },
  { title: 'Tight Arm Reset', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['pressure', 'breathing', 'pressure-reset'], identitySlugs: ['pressure-closer-4-0'] },
  { title: 'Closing Game Routine', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['court', 'match-day'], equipment: ['none'], tags: ['pressure', 'match-day', 'pressure-reset'], identitySlugs: ['pressure-closer-4-0'] },
  { title: 'Post-Match Five-Minute Debrief', category: 'mental-routine', pack: 'Pressure + Mental Reset', setting: ['home', 'match-day'], equipment: ['none'], tags: ['recovery', 'match-day', 'pressure-reset'], identitySlugs: ['pressure-closer-4-0'] },
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
