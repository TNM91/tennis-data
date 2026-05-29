import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

export type PlayerDevelopmentSection = {
  id: string
  title: string
  cue: string
  icon: TiqFeatureIconName
  drills: string[]
  tracker: string[]
}

export type PlayerDevelopmentDiagram =
  | 'movement-screen'
  | 'wide-ball-reset'
  | 'serve-target-ladder'
  | 'second-serve-plus-one'
  | 'ball-call-rally'
  | 'short-ball-approach'
  | 'defensive-neutralizer'
  | 'fatigue-pattern'
  | 'poach-timing'
  | 'doubles-serve-pattern'
  | 'pattern-set'
  | 'player-led-review'
  | 'attack-audit'
  | 'crosscourt-line-change'
  | 'serve-plus-one'
  | 'second-serve-heavy'
  | 'return-step-in'
  | 'inside-baseline'
  | 'approach-volley'
  | 'net-finish'
  | 'attack-reset'
  | 'first-strike-set'

export type PlayerDevelopmentWeek = {
  week: number
  title: string
  objective: string
  diagram: PlayerDevelopmentDiagram
  mainDrill: string
  pressureGame: string
  accountability: string
  coachCue: string
  tiqPrompt: string
}

export type PlayerDevelopmentLevelPath = {
  from: string
  to: string
  context: string
}

export type PlayerDevelopmentPhase = {
  title: string
  weeks: string
  focus: string
  proof: string
}

export type PlayerDevelopmentMetric = {
  skill: string
  baseline: string
  target: string
  evidence: string
  playerPlusAction: string
}

export type CoachLessonPlan = {
  week: number
  focus: string
  objective: string
  blocks: string[]
  homework: string
}

export type TiqIntegrationPrompt = {
  title: string
  cue: string
  href: string
}

export type PlayerDevelopmentIdentityProfile = {
  primaryWeapons: string[]
  pressureHabits: string[]
  styleLeaks: string[]
  matchTriggers: string[]
  coachQuestions: string[]
}

export type PlayerDevelopmentIdentity = {
  slug: string
  title: string
  archetype: string
  ratingBand: string
  programLabel: string
  levelPath: PlayerDevelopmentLevelPath
  audience: string
  promise: string
  mantra: string
  traits: string[]
  outcomes: string[]
  sections: PlayerDevelopmentSection[]
  phases: PlayerDevelopmentPhase[]
  metrics: PlayerDevelopmentMetric[]
  weeks: PlayerDevelopmentWeek[]
  coachLessons: CoachLessonPlan[]
  reusableSheets: string[]
  tiqPrompts: TiqIntegrationPrompt[]
  identityProfile: PlayerDevelopmentIdentityProfile
}

export type PlayerDevelopmentDiagramMeta = {
  title: string
  intent: string
  setup: string
  read: string
}

export const PLAYER_DEVELOPMENT_DIAGRAMS: Record<PlayerDevelopmentDiagram, PlayerDevelopmentDiagramMeta> = {
  'movement-screen': {
    title: 'Split, recover, repeat',
    intent: 'Build first-step discipline and recovery after each directional cue.',
    setup: 'Player starts behind the baseline, reacts to three target balls, then returns to the recovery box.',
    read: 'The player wins the rep only if the split happens before the ball cue and the recovery lane is calm.',
  },
  'wide-ball-reset': {
    title: 'Wide-ball neutralizer',
    intent: 'Defend wide without panic and recover through the center lane.',
    setup: 'Player starts stretched outside the singles sideline, sends a high-margin crosscourt reset, then recovers.',
    read: 'The reset ball should buy time; it is not an emergency winner attempt.',
  },
  'serve-target-ladder': {
    title: 'Wide / Body / T targets',
    intent: 'Show the three called serve locations inside the opposite service box.',
    setup: 'Server starts behind the baseline and calls the target before every serve.',
    read: 'Wide pulls the returner toward the singles sideline, body tracks the returner lane, and T lands on the center service line inside the box.',
  },
  'second-serve-plus-one': {
    title: 'Second serve plus one',
    intent: 'Pair a safer second serve shape with a ready first-ball response.',
    setup: 'Second serve lands with height and spin, then the player recovers for a crosscourt +1.',
    read: 'The point is won by commitment and readiness, not by swinging harder on the second serve.',
  },
  'ball-call-rally': {
    title: 'Attack decision and close',
    intent: 'Train the player to call the ball before choosing attack speed or closing forward.',
    setup: 'Targets show red, yellow, and green decisions, then a forward lane for the earned short ball.',
    read: 'Green balls can be attacked; the rep is not complete until the player closes and splits after advantage.',
  },
  'short-ball-approach': {
    title: 'Short-ball approach',
    intent: 'Turn a short ball into approach, close, split, and finish.',
    setup: 'Player moves forward from the baseline, hits through a deep target, then splits near the service line.',
    read: 'The approach is not complete until the player closes after contact.',
  },
  'defensive-neutralizer': {
    title: 'Defensive neutralizer plus reset',
    intent: 'Use height, margin, recovery, and breathing to survive pressure and regain neutral position.',
    setup: 'Player starts wide, sends the ball high crosscourt into a large safe zone, then resets posture before the next ball.',
    read: 'The best defensive ball creates time and the best recovery keeps the next decision calm.',
  },
  'fatigue-pattern': {
    title: 'Three-ball fatigue pattern',
    intent: 'Preserve decisions and posture after conditioning stress.',
    setup: 'Player completes an interval, then plays a three-ball pattern with recovery after ball three.',
    read: 'Late reps should look slower only in speed, not in posture or target clarity.',
  },
  'poach-timing': {
    title: 'Poach timing read',
    intent: 'Teach the net player when to stay, fake, or go.',
    setup: 'Server and partner align in doubles positions; partner moves based on serve location and returner contact.',
    read: 'The poach lane is earned by serve pressure and early partner movement.',
  },
  'doubles-serve-pattern': {
    title: 'Doubles serve pattern',
    intent: 'Connect serve location with partner movement and middle ownership.',
    setup: 'Server calls wide or T, partner shifts toward the likely return lane.',
    read: 'The pattern is successful when both players know the first movement before the serve.',
  },
  'pattern-set': {
    title: 'Pattern set',
    intent: 'Blend serve target, first ball, and recovery cue into competitive set play.',
    setup: 'Player starts with a called serve and chooses the +1 lane after the serve result.',
    read: 'The goal is repeatable process under score pressure.',
  },
  'player-led-review': {
    title: 'Player-led review',
    intent: 'Let the player choose evidence from the block and explain the next path.',
    setup: 'Player identifies the favorite drill and one pressure rep that proved progress.',
    read: 'The review should reveal ownership, not just coach feedback.',
  },
  'attack-audit': {
    title: 'Attack audit',
    intent: 'Separate earned attack balls from forced attacks.',
    setup: 'Targets show build, neutral, and attack zones before the player chooses acceleration.',
    read: 'The correct decision matters before the shot outcome.',
  },
  'crosscourt-line-change': {
    title: 'Crosscourt to line change',
    intent: 'Earn direction change through crosscourt depth and balance.',
    setup: 'Player builds crosscourt before changing down the line on a balanced ball.',
    read: 'Line changes are only green-light choices after depth creates space.',
  },
  'serve-plus-one': {
    title: 'Serve plus one',
    intent: 'Serve to create the first forehand or pressure ball.',
    setup: 'Server calls a wide target and recovers into the +1 lane.',
    read: 'The serve is judged by the first ball it creates.',
  },
  'second-serve-heavy': {
    title: 'Heavy second serve',
    intent: 'Use spin and height to protect the second serve pattern.',
    setup: 'Serve lands into a safer body window, followed by a heavy crosscourt first ball.',
    read: 'Safe offense still creates pressure when the next ball is prepared.',
  },
  'return-step-in': {
    title: 'Step-in return',
    intent: 'Take time away on second serves with controlled depth.',
    setup: 'Returner steps inside the baseline and sends the ball deep through the middle or crosscourt lane.',
    read: 'The return should start neutral or better without over-swinging.',
  },
  'inside-baseline': {
    title: 'Inside-baseline pressure',
    intent: 'Use court position to take time away without rushing.',
    setup: 'Player steps inside the baseline after earning a shorter ball.',
    read: 'Early feet create pressure before extra racquet speed is needed.',
  },
  'approach-volley': {
    title: 'Approach plus volley',
    intent: 'Close forward after the approach and split before the pass.',
    setup: 'Player approaches, splits, then covers two likely volley lanes.',
    read: 'The point is shaped by forward position, not a single approach shot.',
  },
  'net-finish': {
    title: 'Net finish',
    intent: 'Finish with placement options instead of panic volleys.',
    setup: 'Net player covers two finish targets after closing inside the service line.',
    read: 'The volley decision should match the opponent position and open space.',
  },
  'attack-reset': {
    title: 'Attack reset',
    intent: 'Rebuild the point when the attack is not good enough.',
    setup: 'Player recognizes a forced attack lane and chooses a safer reset target.',
    read: 'Smart aggression includes the courage to not force.',
  },
  'first-strike-set': {
    title: 'First-strike set',
    intent: 'Compete with called serve, return, and first-ball patterns.',
    setup: 'Player starts with a called first-strike plan and tracks whether it created advantage.',
    read: 'Patterns are proven only when they hold up under score pressure.',
  },
}

const dataAssistPlayerDevelopmentHref = '/data-assist?intent=upload-source&context=Player%20development'

export const RELENTLESS_COMPETITOR_IDENTITY: PlayerDevelopmentIdentity = {
  slug: 'relentless-competitor-4-0',
  title: 'The Relentless Competitor',
  archetype: 'Relentless baseline competitor',
  ratingBand: 'USTA 4.0 player',
  programLabel: 'Development path',
  levelPath: {
    from: 'USTA 4.0',
    to: 'USTA 4.5 readiness',
    context: 'Competitive player building a more complete 4.0-to-4.5 identity.',
  },
  audience: 'A competitive player building toward a more complete 4.0-to-4.5 path.',
  promise:
    'Move well, compete hard, serve consistently under pressure, attack the correct ball, defend without panic, and get stronger as matches go on.',
  mantra: 'Active feet. Clear target. Relentless next ball.',
  identityProfile: {
    primaryWeapons: [
      'Consistent serve location and routine under pressure',
      'First-step movement that keeps neutral balls from becoming emergencies',
      'Patient crosscourt patterns until the correct ball appears',
      'Defensive height and recovery that make opponents hit one more ball',
    ],
    pressureHabits: [
      'Uses feet between shots instead of standing to watch',
      'Calls the target before serve, return, or attack ball',
      'Chooses margin when balance is compromised',
      'Resets emotionally after missed opportunities',
    ],
    styleLeaks: [
      'Attacks before the ball is earned',
      'Gets quiet with the feet after a long point',
      'Lets second-serve fear shrink the target',
      'Defends with panic pace instead of height and recovery',
    ],
    matchTriggers: [
      'After losing two straight games',
      'At 30-30, deuce, or break point',
      'When an opponent starts pushing high and deep',
      'When legs feel heavy late in the set',
    ],
    coachQuestions: [
      'Did my feet stay active after contact, or only before the shot?',
      'Which balls did I attack too early?',
      'Did my second serve create a playable first ball?',
      'What pattern made the opponent feel pressure most often?',
    ],
  },
  traits: [
    'Moves before the ball hurts them',
    'Serves to a target under stress',
    'Attacks the correct ball',
    'Defends without panic',
    'Gets stronger late',
  ],
  outcomes: [
    'Clear between-point routine',
    'Repeatable serve targets',
    'Better recovery after wide balls',
    'Smarter attack selection',
    'Coach-ready evidence',
  ],
  sections: [
    {
      id: 'movement',
      title: 'Movement Development',
      cue: 'Win court position before trying to win the point.',
      icon: 'matchPrep',
      drills: ['Split-step rhythm ladder', 'Recover-to-center shadow points', 'Wide ball neutral reset'],
      tracker: ['First step', 'Balance after contact', 'Recovery speed', 'Panic-free defense'],
    },
    {
      id: 'serve',
      title: 'Serve Development',
      cue: 'Make pressure serves boring, repeatable, and target-led.',
      icon: 'reliabilityIndex',
      drills: ['60-ball target ladder', 'Second-serve pressure games', 'Body serve plus first ball'],
      tracker: ['First serve %', 'Second serve trust', 'Target clarity', 'Serve +1 pattern'],
    },
    {
      id: 'strokes',
      title: 'Forehand / Backhand Development',
      cue: 'Attack the correct ball, not every ball.',
      icon: 'matchupAnalysis',
      drills: ['Green-yellow-red ball calling', 'Crosscourt depth builders', 'Short-ball decision reps'],
      tracker: ['Depth', 'Shape', 'Attack selection', 'Error after advantage'],
    },
    {
      id: 'conditioning',
      title: 'Conditioning Section',
      cue: 'Get stronger as the match gets longer.',
      icon: 'playerRatings',
      drills: ['Tennis intervals', 'Point-end recovery breath', 'Third-set footwork finishers'],
      tracker: ['Leg drive', 'Breathing reset', 'Late-match posture', 'Energy after long rallies'],
    },
    {
      id: 'doubles',
      title: 'Doubles Development',
      cue: 'Move with a partner, pressure with position, close with courage.',
      icon: 'lineupBuilder',
      drills: ['Serve-and-first-volley lanes', 'Returner plus net-player calls', 'Poach timing reads'],
      tracker: ['First move', 'Middle ownership', 'Partner cue', 'Net pressure'],
    },
    {
      id: 'accountability',
      title: 'Accountability Tracker',
      cue: 'One module focus, one honest recap, one next action.',
      icon: 'myLab',
      drills: ['Module target selection', 'Coach note review', 'TenAceIQ check-in prompt'],
      tracker: ['Goal set', 'Work completed', 'Match evidence', 'Next focus chosen'],
    },
  ],
  phases: [
    {
      title: 'Build the floor',
      weeks: 'Modules 1-3',
      focus: 'Identity standard, recovery lanes, serve targets, and routine clarity.',
      proof: 'The player can name the target, recover without panic, and repeat the routine under score pressure.',
    },
    {
      title: 'Win better points',
      weeks: 'Modules 4-6',
      focus: 'Second-serve trust, attack selection, short-ball conversion, and defensive neutralizing.',
      proof: 'The player chooses the right ball more often and can rebuild points without panic.',
    },
    {
      title: 'Transfer to matches',
      weeks: 'Modules 7-8',
      focus: 'Doubles pressure, late-match resilience, identity set play, and next-path evidence.',
      proof: 'The player brings coach-ready notes and can explain what should become automatic next.',
    },
  ],
  metrics: [
    {
      skill: 'Movement',
      baseline: 'Splits late or recovers only after seeing the result.',
      target: 'Splits before contact and recovers through the center lane after every wide or attacking ball.',
      evidence: 'Recovery changes at least three rally outcomes in a set.',
      playerPlusAction: 'Log a My Lab movement goal and weekly recovery note.',
    },
    {
      skill: 'Serve pressure',
      baseline: 'Serve intent changes under score pressure.',
      target: 'Calls wide, body, or T before every serve and keeps the same routine at 30-30 or later.',
      evidence: 'Serve chart shows made target patterns, not just made serves.',
      playerPlusAction: 'Save the serve target chart before coach review.',
    },
    {
      skill: 'Attack selection',
      baseline: 'Attacks because the ball looks tempting.',
      target: 'Classifies neutral, build, attack, and short balls before accelerating or closing.',
      evidence: 'Can name two balls correctly built and one short ball closed with balance.',
      playerPlusAction: 'Add a match reflection note on the ball the player is trying to earn.',
    },
    {
      skill: 'Defense',
      baseline: 'Rushes when stretched or tired.',
      target: 'Uses height, margin, recovery, and breath to reset the point without panic.',
      evidence: 'Panic score improves and defensive reset creates neutral balls.',
      playerPlusAction: 'Bring one defensive point note to the next assignment.',
    },
    {
      skill: 'Doubles IQ',
      baseline: 'Moves after the ball instead of with the serve or partner cue.',
      target: 'Calls the pattern before the serve and owns the middle with partner communication.',
      evidence: 'Tracker shows middle balls owned and points won by positioning.',
      playerPlusAction: 'Complete the doubles tracker after one practice set.',
    },
  ],
  weeks: [
    {
      week: 1,
      title: 'Set the standard',
      objective: 'Define the Relentless Competitor identity and capture baseline movement, serve, and match habits.',
      diagram: 'movement-screen',
      mainDrill: 'Movement screen: split, first step, recover, repeat for five clean cycles.',
      pressureGame: 'First-to-seven consistency points where only balanced finishes count.',
      accountability: 'Write the one habit that will make opponents feel pressure by game three.',
      coachCue: 'Reward calm posture and early recovery more than winners.',
      tiqPrompt: 'Set one Player goal in My Lab tied to movement or serve reliability.',
    },
    {
      week: 2,
      title: 'Recover like a competitor',
      objective: 'Build a repeatable recovery lane after wide balls and after attacking.',
      diagram: 'wide-ball-reset',
      mainDrill: 'Wide-ball reset: defend high crosscourt, recover, then play the next ball neutral.',
      pressureGame: 'Two-shot survival: player earns points only by resetting and winning the next neutral ball.',
      accountability: 'Track three points where recovery changed the rally.',
      coachCue: 'Say recover before result; the habit matters before the score does.',
      tiqPrompt: 'Log a recap note about recovery speed and panic level.',
    },
    {
      week: 3,
      title: 'Serve to targets',
      objective: 'Make serve intent visible with clear targets and repeatable routines.',
      diagram: 'serve-target-ladder',
      mainDrill: '60-ball serve ladder: wide, body, T targets with routine before every serve.',
      pressureGame: '30-30 serving: miss target twice and restart the game score.',
      accountability: 'Circle the target that felt most reliable under pressure.',
      coachCue: 'Ask for target first, technique second.',
      tiqPrompt: 'Save a serve target chart and bring the result into the next coach review.',
    },
    {
      week: 4,
      title: 'Trust the second serve',
      objective: 'Reduce fear on second serves by pairing shape, height, and first-ball readiness.',
      diagram: 'second-serve-plus-one',
      mainDrill: 'Second-serve plus one: hit shape, recover, play the next ball crosscourt.',
      pressureGame: 'Second-serve only tiebreak with double-fault consequence reset breathing.',
      accountability: 'Write the cue that made the second serve feel most repeatable.',
      coachCue: 'Praise committed shape, not just made serves.',
      tiqPrompt: 'Add one match reflection note about serve pressure moments.',
    },
    {
      week: 5,
      title: 'Attack the correct ball',
      objective: 'Separate neutral, build, attack, and short-ball opportunities before choosing speed.',
      diagram: 'ball-call-rally',
      mainDrill: 'Green-yellow-red ball calling into short-ball approach: call it, earn it, close it.',
      pressureGame: 'Attack only green balls; bonus point for a clean short-ball approach and split.',
      accountability: 'List two balls you wanted to attack but correctly built instead, plus one short ball you closed.',
      coachCue: 'Make the player call the ball before the swing and keep moving after the advantage.',
      tiqPrompt: 'Use Matchup prep language: what ball are you trying to earn against this opponent?',
    },
    {
      week: 6,
      title: 'Defend without panic',
      objective: 'Use height, margin, recovery, and breathing when the point turns defensive or late-match tired.',
      diagram: 'defensive-neutralizer',
      mainDrill: 'Emergency defense plus fatigue finish: high crosscourt neutralizer, recover, play one calm next ball.',
      pressureGame: 'Third-set defender starts: every game starts at 30-30 and the player must earn neutral before attacking.',
      accountability: 'Grade panic level and posture from 1-5 after each defensive point set.',
      coachCue: 'Long, high, recover, breathe. Panic-free defense is a weapon.',
      tiqPrompt: 'Bring one defensive point and one late-match habit to the recap.',
    },
    {
      week: 7,
      title: 'Pressure with partner patterns',
      objective: 'Improve doubles first move, partner communication, serve location, and middle ownership.',
      diagram: 'doubles-serve-pattern',
      mainDrill: 'Serve location plus net shift: wide, body, and T calls tied to partner movement.',
      pressureGame: 'Doubles pattern games where the pair must call the plan before the serve.',
      accountability: 'Track middle balls owned, partner cues used, and points won by positioning.',
      coachCue: 'Communication before contact makes movement easier after contact.',
      tiqPrompt: 'Use the doubles tracker after one practice set.',
    },
    {
      week: 8,
      title: 'Play the identity',
      objective: 'Blend movement, serve, attack selection, defense, conditioning, and doubles awareness into set play.',
      diagram: 'pattern-set',
      mainDrill: 'Pattern sets: serve target, first-ball target, recovery cue.',
      pressureGame: 'Identity set: player earns bonus points for process wins.',
      accountability: 'Choose the one identity trait that showed up most under score pressure and the next habit to automate.',
      coachCue: 'Coach the standard between points, then let the player compete.',
      tiqPrompt: 'Complete a match reflection and set the next development goal in My Lab.',
    },
  ],
  coachLessons: [
    {
      week: 1,
      focus: 'Identity + baseline',
      objective: 'Build the standard: ready feet, calm defense, clear targets.',
      blocks: ['Movement screen', 'Serve baseline', 'Identity goal sheet'],
      homework: 'Log two practices and write one match habit to improve.',
    },
    {
      week: 2,
      focus: 'Recovery lanes',
      objective: 'Recover after defense and after attack without drifting.',
      blocks: ['Shadow lanes', 'Wide-ball reset', 'Recovery scoring'],
      homework: 'Track three points where recovery changed the rally.',
    },
    {
      week: 3,
      focus: 'Serve targets',
      objective: 'Raise target clarity and routine consistency.',
      blocks: ['Serve ladder', 'Target calls', '30-30 serve games'],
      homework: 'Complete the serve target chart.',
    },
    {
      week: 4,
      focus: 'Second-serve trust',
      objective: 'Build shape, height, and serve-plus-one readiness.',
      blocks: ['Spin window', 'Second-serve tiebreak', 'Serve +1 crosscourt'],
      homework: 'Write the cue that helped second-serve commitment.',
    },
    {
      week: 5,
      focus: 'Correct-ball attack',
      objective: 'Train the player to classify, earn, and close attacking balls.',
      blocks: ['Ball-color calls', 'Short-ball close', 'Attack restraint scoring'],
      homework: 'Write two patient attacks and one short ball closed with balance.',
    },
    {
      week: 6,
      focus: 'Panic-free defense',
      objective: 'Use height, margin, breathing, and recovery to survive pressure.',
      blocks: ['Emergency crosscourt', 'Fatigue finish', 'Defender-start points'],
      homework: 'Grade panic level and posture after one set.',
    },
    {
      week: 7,
      focus: 'Doubles pressure',
      objective: 'Tie serve and return plans to partner movement and middle ownership.',
      blocks: ['Serve location map', 'Partner shift', 'Called-pattern games'],
      homework: 'Complete the doubles development tracker.',
    },
    {
      week: 8,
      focus: 'Identity set play',
      objective: 'Compete with the full Relentless Competitor standard.',
      blocks: ['Pattern sets', 'Process bonus scoring', 'Player-led review'],
      homework: 'Complete the match reflection sheet and set the next development goal in My Lab.',
    },
  ],
  reusableSheets: [
    'Player recap',
    'Coach evaluation page',
    'Match reflection page',
    'Serve target chart',
    'Doubles development tracker',
    'Assignment sheet',
  ],
  tiqPrompts: [
    {
      title: 'Set Player goal',
      cue: 'Turn the identity into one My Lab goal.',
      href: '/mylab',
    },
    {
      title: 'Prep matchup',
      cue: 'Use the module focus to choose what to watch before the next match.',
      href: '/matchup',
    },
    {
      title: 'Improve data',
      cue: 'Upload scorecards or notes when the tennis context needs to refresh.',
      href: dataAssistPlayerDevelopmentHref,
    },
    {
      title: 'Bring to coach',
      cue: 'Use the recap and evaluation sheets as the next lesson handoff.',
      href: '/player-development/coach-planner',
    },
  ],
}

export const SMART_ATTACKER_IDENTITY: PlayerDevelopmentIdentity = {
  slug: 'smart-attacker-4-0-to-4-5',
  title: 'The Smart Attacker',
  archetype: 'Pattern-first attacker',
  ratingBand: 'USTA 4.0-to-4.5 development path',
  programLabel: 'Development path',
  levelPath: {
    from: 'USTA 4.0',
    to: 'USTA 4.5',
    context: 'Competitive player turning pressure creation into cleaner point-ending offense.',
  },
  audience: 'A player who already competes well and now needs cleaner offense, better court position, and more point-ending confidence.',
  promise:
    'Earn short balls, serve with a first-strike plan, take time away at the right moment, close forward, and attack without donating errors.',
  mantra: 'Earn it. Step in. Finish clean.',
  identityProfile: {
    primaryWeapons: [
      'Court position that takes time away',
      'Crosscourt pressure that earns the line change',
      'Short-ball recognition and forward closing',
      'Serve plus one patterns that create the first advantage',
    ],
    pressureHabits: [
      'Builds before changing direction',
      'Splits after every approach or transition',
      'Uses placement before extra racquet speed',
      'Checks balance before calling a ball green',
    ],
    styleLeaks: [
      'Forces line changes from neutral balls',
      'Approaches without closing after contact',
      'Mistakes a short ball for a finish ball',
      'Lets impatience replace pattern construction',
    ],
    matchTriggers: [
      'When the opponent floats a short ball',
      'After winning several neutral exchanges',
      'When the return lands short or central',
      'When a point has been built but not finished',
    ],
    coachQuestions: [
      'Was the attack earned by depth, balance, or court position?',
      'Did I close after the approach?',
      'Which pattern created the short ball?',
      'Did my serve create a clear +1 option?',
    ],
  },
  traits: [
    'Earns attackable balls before forcing',
    'Pairs serve targets with first-strike patterns',
    'Takes time away without rushing',
    'Closes forward with purpose',
    'Uses offense to apply pressure, not escape pressure',
  ],
  outcomes: [
    'Called serve +1 patterns',
    'Cleaner direction changes',
    'Higher quality second-serve returns',
    'More purposeful forward movement',
    'Lower donated-error count',
  ],
  sections: [
    {
      id: 'patterns',
      title: 'Pattern Development',
      cue: 'Build points until the attack is earned.',
      icon: 'scenarioBuilder',
      drills: ['Crosscourt build plus line change', 'Two-heavy-one-forward pattern', 'Open-court recognition reps'],
      tracker: ['Pattern clarity', 'Depth before attack', 'Direction choice', 'Error after opening'],
    },
    {
      id: 'serve-plus-one',
      title: 'Serve +1 Development',
      cue: 'Serve to create the first ball you want.',
      icon: 'reliabilityIndex',
      drills: ['Serve target plus forehand lane', 'Body serve jam response', 'Second serve plus neutral ball'],
      tracker: ['Target called', 'First ball made', 'Court position', 'Pressure after serve'],
    },
    {
      id: 'return-pressure',
      title: 'Return Pressure',
      cue: 'Start return games with shape, depth, and immediate court position.',
      icon: 'matchupAnalysis',
      drills: ['Deep middle return reps', 'Chip and recover', 'Second-serve step-in returns'],
      tracker: ['Return depth', 'Time taken away', 'Recovery', 'Neutral or better start'],
    },
    {
      id: 'net-close',
      title: 'Forward Closing',
      cue: 'Move through the court and finish with balance.',
      icon: 'lineupBuilder',
      drills: ['Approach plus first volley', 'Swing volley decision reps', 'Overhead footwork ladder'],
      tracker: ['Approach target', 'Split timing', 'Volley placement', 'Finish rate'],
    },
    {
      id: 'transition-defense',
      title: 'Attack Reset',
      cue: 'When the attack is not there, reset without ego.',
      icon: 'matchPrep',
      drills: ['Attack-or-reset calling', 'Approach recovery reset', 'High-margin re-build balls'],
      tracker: ['Reset choice', 'Margin', 'Balance', 'Next-ball readiness'],
    },
    {
      id: 'accountability',
      title: 'Offense Accountability',
      cue: 'Track whether aggression created pressure or donated points.',
      icon: 'myLab',
      drills: ['Aggression audit', 'Pattern evidence review', 'TenAceIQ goal check-in'],
      tracker: ['Earned attack', 'Clean finish', 'Forced error', 'Donated error'],
    },
  ],
  phases: [
    {
      title: 'Earn the attack',
      weeks: 'Modules 1-4',
      focus: 'Attack audit, crosscourt build, serve-plus-one plans, and safer heavy second-serve patterns.',
      proof: 'The player can explain why an attack was earned before judging whether the shot landed.',
    },
    {
      title: 'Take time away',
      weeks: 'Modules 5-8',
      focus: 'Return step-in, inside-baseline pressure, forward closing, and net finish decisions.',
      proof: 'The player pressures opponents with position and balance instead of rushing the swing.',
    },
    {
      title: 'Compete with patterns',
      weeks: 'Modules 9-12',
      focus: 'Attack resets, first-strike sets, pattern evidence, and next-path review.',
      proof: 'The player knows which patterns created advantage and which attacks donated errors.',
    },
  ],
  metrics: [
    {
      skill: 'Pattern clarity',
      baseline: 'Attacks without a repeatable pattern.',
      target: 'Starts points with a named serve, return, or rally pattern and knows the next ball.',
      evidence: 'Pattern sheet shows which pattern created advantage most often.',
      playerPlusAction: 'Set one My Lab pattern goal.',
    },
    {
      skill: 'Shot selection',
      baseline: 'Confuses aggression with speed.',
      target: 'Separates build, strike, and reset decisions before choosing pace.',
      evidence: 'Attack audit shows fewer forced attacks and clearer green-ball choices.',
      playerPlusAction: 'Add a match reflection on the best earned attack.',
    },
    {
      skill: 'Court position',
      baseline: 'Stays too deep after creating advantage.',
      target: 'Moves inside the baseline or closes forward when the pattern earns space.',
      evidence: 'Coach review shows approach and volley decisions match court position.',
      playerPlusAction: 'Bring one approach sequence to coach review.',
    },
    {
      skill: 'Net finish',
      baseline: 'Approaches but does not close decisively.',
      target: 'Approaches through a target, closes, splits, and finishes with a clear volley decision.',
      evidence: 'Volley tracker separates first volley quality from point result.',
      playerPlusAction: 'Complete the assignment sheet after a live-point block.',
    },
    {
      skill: 'Reset discipline',
      baseline: 'Forces the next attack after a weak first strike.',
      target: 'Recognizes when the attack is not good enough and rebuilds the point.',
      evidence: 'Review sheet names one smart reset that prevented a bad error.',
      playerPlusAction: 'Log a Player+ note on restraint under pressure.',
    },
  ],
  weeks: [
    {
      week: 1,
      title: 'Define smart offense',
      objective: 'Separate earned aggression from rushed aggression and set the attacking standard.',
      diagram: 'attack-audit',
      mainDrill: 'Neutral-build-attack calling: player names build or attack before contact.',
      pressureGame: 'Attack audit set: bonus point for earned attacks, penalty for donated errors.',
      accountability: 'Write the difference between brave offense and impatient offense.',
      coachCue: 'Praise the decision before the result.',
      tiqPrompt: 'Set a My Lab goal for reducing donated attacking errors.',
    },
    {
      week: 2,
      title: 'Build before changing direction',
      objective: 'Use depth and shape to earn the line change instead of forcing it early.',
      diagram: 'crosscourt-line-change',
      mainDrill: 'Three crosscourt balls before line-change permission.',
      pressureGame: 'Direction discipline points: early line misses count double.',
      accountability: 'Track how often depth created the short ball.',
      coachCue: 'Ask what the previous ball earned.',
      tiqPrompt: 'Log one pattern that consistently opened court space.',
    },
    {
      week: 3,
      title: 'Serve with a first-strike plan',
      objective: 'Connect serve target to the next-ball lane.',
      diagram: 'serve-plus-one',
      mainDrill: 'Serve wide plus open-court forehand, body serve plus jam ball, T serve plus middle attack.',
      pressureGame: 'Called-pattern service games where only called patterns earn bonus points.',
      accountability: 'Circle the serve +1 pattern that felt most repeatable.',
      coachCue: 'Target, first ball, recovery. Always all three.',
      tiqPrompt: 'Use the serve target chart before the next match.',
    },
    {
      week: 4,
      title: 'Protect the second serve pattern',
      objective: 'Keep second-serve points offensive enough without gambling.',
      diagram: 'second-serve-heavy',
      mainDrill: 'Second serve plus heavy first ball to the safer crosscourt lane.',
      pressureGame: 'Second-serve pattern tiebreak: point starts only after a target call.',
      accountability: 'Write the second-serve pattern you trust at 30-40.',
      coachCue: 'Offense can be heavy and deep, not just fast.',
      tiqPrompt: 'Reflect on one pressure second serve in the match reflection sheet.',
    },
    {
      week: 5,
      title: 'Step in on second serves',
      objective: 'Take time away on attackable returns without over-swinging.',
      diagram: 'return-step-in',
      mainDrill: 'Second-serve return step-in: deep middle, crosscourt angle, or controlled line.',
      pressureGame: 'Return pressure games starting every point on a second serve.',
      accountability: 'Track returns that started neutral or better.',
      coachCue: 'Short backswing, big target, early recovery.',
      tiqPrompt: 'Prep matchup: identify where this opponent gives you second-serve looks.',
    },
    {
      week: 6,
      title: 'Take time away',
      objective: 'Use court position to pressure the opponent without rushing the swing.',
      diagram: 'inside-baseline',
      mainDrill: 'Inside-baseline rally reps with shape target and recovery step.',
      pressureGame: 'Time-away points: player must step in only after earning position.',
      accountability: 'List two moments where better court position mattered more than speed.',
      coachCue: 'Early feet create calm hands.',
      tiqPrompt: 'Add one note to My Lab about court position.',
    },
    {
      week: 7,
      title: 'Close forward',
      objective: 'Turn short balls into approach, split, and finish sequences.',
      diagram: 'approach-volley',
      mainDrill: 'Approach plus first volley with target call before approach contact.',
      pressureGame: 'Approach games: win two shots after the approach to earn the point.',
      accountability: 'Track approach targets and finish rate.',
      coachCue: 'Close through the ball, then split before the pass.',
      tiqPrompt: 'Bring approach evidence to coach review.',
    },
    {
      week: 8,
      title: 'Finish at net',
      objective: 'Improve volley placement, overhead readiness, and calm finishes.',
      diagram: 'net-finish',
      mainDrill: 'Volley direction ladder: behind, open court, drop angle, deep middle.',
      pressureGame: 'Net closeout games starting from an approach advantage.',
      accountability: 'Write which finish choice produced the cleanest pressure.',
      coachCue: 'The volley is a placement decision, not a panic swing.',
      tiqPrompt: 'Complete the coach evaluation page for forward closing.',
    },
    {
      week: 9,
      title: 'Attack in doubles',
      objective: 'Use first move, poach timing, and return positioning to create pressure.',
      diagram: 'poach-timing',
      mainDrill: 'Serve location plus planned poach or fake.',
      pressureGame: 'Doubles pressure set with called first move before every serve.',
      accountability: 'Track how many points your movement affected.',
      coachCue: 'Make the opponent solve your position.',
      tiqPrompt: 'Use the doubles development tracker after a set.',
    },
    {
      week: 10,
      title: 'Reset failed attacks',
      objective: 'Rebuild the point when the attack ball is not good enough.',
      diagram: 'attack-reset',
      mainDrill: 'Attack-or-reset feeds with coach varying height and depth.',
      pressureGame: 'Reset bonus points: player scores for choosing not to force.',
      accountability: 'Name one reset that prevented a donated error.',
      coachCue: 'Smart attackers keep the point alive when the finish is not there.',
      tiqPrompt: 'Log an aggression audit in the recap.',
    },
    {
      week: 11,
      title: 'Play first-strike sets',
      objective: 'Compete with planned serve, return, and transition patterns.',
      diagram: 'first-strike-set',
      mainDrill: 'Pattern set warmup: two serve patterns and two return patterns.',
      pressureGame: 'First-strike set: bonus for called patterns that create advantage.',
      accountability: 'Choose the pattern that held up best under score pressure.',
      coachCue: 'Do less guessing between points; choose the next pattern.',
      tiqPrompt: 'Complete a match reflection focused on pattern success.',
    },
    {
      week: 12,
      title: 'Prove the attack identity',
      objective: 'Review evidence and choose the next offensive or all-court development path.',
      diagram: 'player-led-review',
      mainDrill: 'Player-led favorite pattern sequence from the block.',
      pressureGame: 'Best-of-three tiebreaks with written pattern plans.',
      accountability: 'Write what must become automatic before the 4.5 jump.',
      coachCue: 'Let the player own the pattern menu.',
      tiqPrompt: 'Set the next Player goal in My Lab.',
    },
  ],
  coachLessons: [
    {
      week: 1,
      focus: 'Smart offense baseline',
      objective: 'Define earned attack versus donated error.',
      blocks: ['Aggression audit', 'Build/attack calls', 'Goal sheet'],
      homework: 'Track donated attacking errors for one match.',
    },
    {
      week: 2,
      focus: 'Direction discipline',
      objective: 'Build depth before changing direction.',
      blocks: ['Crosscourt build', 'Line-change permission', 'Depth scoring'],
      homework: 'Write how depth created short balls.',
    },
    {
      week: 3,
      focus: 'Serve +1 map',
      objective: 'Connect serve target to next-ball plan.',
      blocks: ['Target ladder', 'First-ball lanes', 'Called-pattern games'],
      homework: 'Complete serve +1 target chart.',
    },
    {
      week: 4,
      focus: 'Second-serve offense',
      objective: 'Use heavy, safe offense after second serves.',
      blocks: ['Second-serve shape', 'Heavy first ball', 'Pressure tiebreak'],
      homework: 'Write trusted 30-40 second-serve pattern.',
    },
    {
      week: 5,
      focus: 'Return pressure',
      objective: 'Step in on second serves with controlled targets.',
      blocks: ['Deep middle return', 'Step-in timing', 'Return games'],
      homework: 'Track neutral-or-better return starts.',
    },
    {
      week: 6,
      focus: 'Court position',
      objective: 'Take time away through better position.',
      blocks: ['Inside-baseline reps', 'Shape target', 'Recovery step'],
      homework: 'Log one court-position win.',
    },
    {
      week: 7,
      focus: 'Approach sequence',
      objective: 'Approach, split, and finish with balance.',
      blocks: ['Short-ball target', 'Approach plus volley', 'Pass-read reps'],
      homework: 'Track approach finish rate.',
    },
    {
      week: 8,
      focus: 'Net finishing',
      objective: 'Place volleys and overheads calmly.',
      blocks: ['Volley ladder', 'Overhead footwork', 'Closeout games'],
      homework: 'Write best finish choice.',
    },
    {
      week: 9,
      focus: 'Doubles pressure',
      objective: 'Create pressure with first move and partner pattern.',
      blocks: ['Poach/fake calls', 'Serve location', 'Returner plus partner'],
      homework: 'Complete doubles tracker.',
    },
    {
      week: 10,
      focus: 'Attack reset',
      objective: 'Rebuild when the finish is not earned.',
      blocks: ['Attack/reset call', 'High-margin rebuild', 'Reset scoring'],
      homework: 'Name one reset that saved a point.',
    },
    {
      week: 11,
      focus: 'First-strike sets',
      objective: 'Compete with planned serve and return patterns.',
      blocks: ['Pattern warmup', 'Called set play', 'Between-point plan'],
      homework: 'Complete pattern reflection.',
    },
    {
      week: 12,
      focus: 'Evaluation + next path',
      objective: 'Review offensive evidence and choose the next identity.',
      blocks: ['Player-led menu', 'Skill evaluation', 'Next goal'],
      homework: 'Set next My Lab goal.',
    },
  ],
  reusableSheets: [
    'Player recap',
    'Coach evaluation page',
    'Match reflection page',
    'Serve +1 pattern chart',
    'Attack decision tracker',
    'Assignment sheet',
  ],
  tiqPrompts: [
    {
      title: 'Set Player goal',
      cue: 'Turn the attack identity into one My Lab goal.',
      href: '/mylab',
    },
    {
      title: 'Prep matchup',
      cue: 'Choose the serve, return, and attack pattern before match day.',
      href: '/matchup',
    },
    {
      title: 'Track evidence',
      cue: 'Use recaps to separate pressure created from points donated.',
      href: '/player-development/smart-attacker-4-0-to-4-5/workbook',
    },
    {
      title: 'Bring to coach',
      cue: 'Review pattern evidence before the next lesson.',
      href: '/player-development/smart-attacker-4-0-to-4-5/coach-planner',
    },
  ],
}

export const PLAYER_DEVELOPMENT_IDENTITIES = [
  RELENTLESS_COMPETITOR_IDENTITY,
  SMART_ATTACKER_IDENTITY,
] as const

export function getPlayerDevelopmentIdentity(slug = RELENTLESS_COMPETITOR_IDENTITY.slug) {
  return PLAYER_DEVELOPMENT_IDENTITIES.find((identity) => identity.slug === slug) ?? RELENTLESS_COMPETITOR_IDENTITY
}

