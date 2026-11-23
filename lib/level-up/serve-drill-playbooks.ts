import type {DrillPlaybook} from './drill-playbooks'

// Original TenAceIQ practice formats. Placement and routine quality use separate counts.
export const SERVE_DRILL_PLAYBOOKS:Record<string,DrillPlaybook>={
 'serve-target-ladder':{
  players:1,
  setup:['Use a full court, a racket and ten balls. Serve from behind the baseline into the diagonally opposite service box. Keep spare balls away from your feet.','Use broad wide, middle (body) and T lanes across the width of that service box. Place any flat markers outside the landing area. The five-target pattern is wide, body, T, body, wide.'],
  countLabel:'Target serves',countRule:'Count a serve when you call the next zone before the motion and land in that zone of the correct service box. A fault, wrong zone or missing call is a miss. Repeat service lets; a caught unused toss is not an attempt. Keep the pattern moving after a miss.',
  easier:'Use the whole diagonal service box as the target at a comfortable pace. Note the larger target if you adapt the drill; use the same setup when comparing sessions.',
  advance:'Try Add pressure after two rounds of 7/10 target serves with a steady routine. Keep the same broad zones; placement counts are not a TiQ threshold.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Place the serve through a repeatable target pattern.',steps:['From the deuce side, call and serve to wide, body, T, body, wide in that order. Use a comfortable second-serve pace and keep the starting position legal.','From the ad side, repeat the same five-target order into its diagonal service box. Continue to the next target after a miss; do not add replacement balls for faults.','Record target serves out of ten, repeating service lets without adding an attempt. Collect balls only when the court is clear and rest for 30–45 seconds.','Complete three rounds with the same zones and pace. A short count is a reason to use a larger target, not to rush the next serve.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep the target pattern while changing serving sides under practice pressure.',steps:['Treat each serve as a second serve at 30–40. Serve a deuce/ad pair to wide, then a pair to body, T, body and wide: ten attempts in all.','Call the zone before each motion and reset behind the baseline as you change halves. Use the same manageable pace; this is a practice score, not a recorded game.','Record target serves out of ten. Keep faults and wrong zones as misses, replay service lets and continue the pattern without starting the tally again.','Rest for 30–45 seconds and complete three rounds. Return to five serves from each side if the side changes disrupt your target or routine.']},
  ],
 },
 'second-serve-routine-reps':{
  players:1,
  setup:['Use a court, a racket and ten balls. Start behind the baseline and choose a large target inside the diagonal service box. These are live serves; use a separate shadow drill for no-ball rehearsal.','Choose one breath, a target call and a comfortable motion you can repeat. Finish balanced and use the same reset after a make or a miss. Keep your feet clear of the baseline until contact.'],
  countLabel:'Routine reps kept',countRule:'Count a completed serve when the breath, target call, comfortable motion, balanced finish and calm reset all happen. A net or out fault can still count for this routine task; a foot fault or missed routine step cannot. Repeat service lets and unused tosses. This count is not serve accuracy.',
  easier:'Serve at an easier pace toward the whole diagonal service box while keeping the same breath, target call and reset. Do not replace the routine with a hurried push.',
  advance:'Try Add pressure after two rounds of 8/10 routines kept, including calm resets after misses. Keep serves made separate from this count; it does not measure accuracy or change TiQ.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Repeat the same second-serve routine after every result.',steps:['Choose the target, breathe and use your comfortable second-serve motion. Complete five serves from the deuce side and five from the ad side.','After every serve, finish balanced and reset before starting again. A net or out ball uses an attempt and can still meet the routine rule.','Record routines kept out of ten, including the misses in your attempts. Replay service lets and unused tosses; do not turn this count into serves landed.','Collect safely, rest for 30–45 seconds and complete three rounds. Keep the same routine after good and poor serves.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep the routine when every practice attempt feels like a second serve.',steps:['Treat each attempt as a second serve at 30–40. Choose a target before the motion; vary wide, body or T without repeating the last choice.','Serve five from each side. Keep the same breath, comfortable motion, balanced finish and calm reset after a make or a miss. Do not add another ball to erase a fault.','Record routines kept out of ten. A net or out fault may still meet the routine rule; a rushed reset, missing target call or foot fault is a miss for this task.','Rest and complete three rounds. Return to a fixed large target if choosing a new zone makes you hurry; practice counts do not record game wins.']},
  ],
 },
}
