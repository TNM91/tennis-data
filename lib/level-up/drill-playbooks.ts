import {DOUBLES_DRILL_PLAYBOOKS} from './doubles-drill-playbooks'
import {GROUNDSTROKE_DRILL_PLAYBOOKS} from './groundstroke-drill-playbooks'
import {NET_DRILL_PLAYBOOKS} from './net-drill-playbooks'
import {SERVE_DRILL_PLAYBOOKS} from './serve-drill-playbooks'
import {RETURN_DRILL_PLAYBOOKS} from './return-drill-playbooks'
import {CONDITIONING_DRILL_PLAYBOOKS} from './conditioning-drill-playbooks'

export type DrillVersionId = 'control' | 'pressure'
export type DrillVersion = {id:DrillVersionId;label:string;rounds:number;reps:number;focus:string;steps:string[];requiresPartner?:boolean}
export type DrillPlaybook = {
  players:1|2|3|4;setup:string[];countLabel:string;countRule:string;easier:string;advance:string;
  versions:[DrillVersion,DrillVersion]
}

// Original TenAceIQ practice instructions. Counts describe practice, not a TiQ rating.
const playbooks:Record<string,DrillPlaybook>={
  ...DOUBLES_DRILL_PLAYBOOKS,
  ...GROUNDSTROKE_DRILL_PLAYBOOKS,
  ...NET_DRILL_PLAYBOOKS,
  ...SERVE_DRILL_PLAYBOOKS,
  ...RETURN_DRILL_PLAYBOOKS,
  ...CONDITIONING_DRILL_PLAYBOOKS,
  'serve-target-call':{
    players:1,
    setup:['Use a full court, a racket and ten balls. Start behind the baseline.','Aim into the diagonal service box. Use flat markers outside the landing area to divide it into wide, body and T zones.'],
    countLabel:'Serves on target',countRule:'Count a serve only when you call the target before the motion and land in the chosen part of the correct service box. A fault counts as a miss.',
    easier:'Aim for the whole diagonal service box at a comfortable second-serve pace. Keep the same pre-serve routine.',
    advance:'Try Add pressure after two rounds of 7/10 or better with a steady routine. This is a practice target, not a rating threshold.',
    versions:[
      {id:'control',label:'Build control',rounds:3,reps:10,focus:'Repeat a dependable second serve.',steps:['Choose the wide half or T half of the diagonal service box. Call it before each serve.','Hit five second serves from the deuce side and five from the ad side. Keep the same breath and bounce routine.','Count target hits out of ten. Collect balls only when the court is clear, then rest for 30–45 seconds.','Repeat for three rounds. Compare target hits and routine quality, rather than chasing pace.']},
      {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep the target and routine clear when the score matters.',steps:['Use the wide, body and T thirds of the diagonal service box. Call a zone before each motion.','Treat each serve as a second serve at 30–40. Hit five from each side; a fault is a miss, with no replacement serve.','Record target hits out of ten, then collect and rest for 30–45 seconds. Keep the routine after a miss.','Repeat for three rounds. If target or routine breaks down, return to the larger target.']},
    ],
  },
  'return-depth-lane':{
    players:2,
    setup:['Work with a server or feeder on the opposite baseline, with ten balls.','Choose a crosscourt or middle lane between the opposite service line and baseline. Use flat markers outside the hitting lane.'],
    countLabel:'Deep returns',countRule:'Count a return only if it lands beyond the opposite service line, inside the chosen lane and court, and you recover to ready. A short ball, fault or missed recovery is a miss.',
    easier:'Use gentle racket feeds from the opposite service line and the full singles width as your target. A feed is practice, not a live-serve test.',
    advance:'Try Add pressure after two rounds of 7/10 or better with balanced recovery. Keep the same lane so the comparison is useful.',
    versions:[
      {id:'control',label:'Build control',rounds:3,reps:10,focus:'Start the point with depth and a recovery step.',steps:['Call a crosscourt or deep-middle target before the server starts. Use controlled second serves; repeat a serve fault without counting it as a return attempt.','Return five valid serves from the deuce court and five from the ad court. Recover after each return.','Count deep returns out of ten. Switch server and returner, then rest for 30–45 seconds.','Repeat for three rounds each. Keep the return compact and choose margin over a winner.']},
      {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Hold depth when serve pace and location vary.',steps:['Keep the same deep target. Let the server mix first- and second-serve pace and vary location within a pace you can handle.','Return five valid serves from each side. Repeat serve faults; count every attempted return of a valid serve, including misses.','Recover to ready after contact and count only deep returns with recovery. Switch roles after ten and rest.','Repeat for three rounds. Compare the counts only with rounds using the same serve pace and target.']},
    ],
  },
  'wall-rally-rhythm':{
    players:1,
    setup:['Use a tennis practice wall, a racket and a ball, with clear space behind you.','Choose a visible window above the wall’s net line. Stand far enough back for a comfortable bounce; never use a wall facing people or traffic.'],
    countLabel:'Controlled contacts',countRule:'Count a contact when the ball reaches your chosen window and you reset your feet in balance. A miss or a hit without the reset is a miss; restart the rally and continue the ten attempts.',
    easier:'Drop-hit once, catch the rebound and reset before the next rep. Use a bigger height window.',
    advance:'Try Add pressure after two rounds of 8/10 or better. Keep the same wall distance and window when comparing results.',
    versions:[
      {id:'control',label:'Build control',rounds:3,reps:10,focus:'Find repeatable contact and a foot reset.',steps:['Drop-hit to the window, let the ball bounce once and recover your feet between contacts. Keep the pace comfortable.','Make five forehand attempts, then five backhand attempts. Restart after a miss without erasing it from the count.','Record controlled contacts out of ten and rest for 30 seconds. Keep the same window and distance.','Repeat for three rounds. Focus on spacing and balance before trying a longer rally.']},
      {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Change wings without losing spacing or rhythm.',steps:['Keep the same wall window and distance. Alternate forehand and backhand after each rebound.','Make ten contact attempts, including misses. Recover toward your starting position before turning for the next side.','Record controlled contacts out of ten and rest for 30 seconds. Slow the ball down if you start reaching.','Repeat for three rounds. Use catch-and-reset reps again if you cannot change wings in balance.']},
    ],
  },
  'split-step-rhythm':{
    players:1,
    setup:['Choose a clear, dry space with room for two controlled steps in either direction.','Use a line as your ready position. A partner can give a contact cue and point left or right; solo, rehearse the same timing with an imagined opponent.'],
    countLabel:'Balanced first moves',countRule:'Count a rep when the contact cue, quiet split landing, balanced first step and return to ready happen in order. A guessed direction, late start or loss of balance is a miss.',
    easier:'Walk the pattern with a predictable direction. Rehearse a small split and balanced first step before adding speed.',
    advance:'Try Add pressure after two rounds of 8/10 or better. Compare solo rehearsal with solo rehearsal, and partner-cued work with partner-cued work.',
    versions:[
      {id:'control',label:'Build control',rounds:3,reps:10,focus:'Connect the split landing to the first move.',steps:['Start on your ready line. Rehearse a small split as the opponent would make contact; land softly, ready to move.','Alternate one controlled first step left and right. Return to ready after each rep, for ten attempts.','Count balanced first moves out of ten and rest for 30 seconds. Stop the round if the space or footing becomes unsafe.','Repeat for three rounds. Solo timing is rehearsal; use a partner cue when you want to test a reaction.']},
      {id:'pressure',label:'Add pressure',rounds:3,reps:10,requiresPartner:true,focus:'Read a cue before choosing the first move.',steps:['Use a partner who gives a contact cue, then points left or right as you land. Do not choose a direction early.','Take a controlled first step toward the point, then recover to the line. Make ten attempts.','Count balanced, correctly directed moves out of ten and rest for 30 seconds. A guess is a miss.','Repeat for three rounds. Without a partner, use Build control instead of treating a planned move as a reaction test.']},
    ],
  },
  'volley-ready-split':{
    players:2,
    setup:['Use a court, a racket, ten balls and a cooperative feeder on the opposite side of the net.','Start near your service line. Choose a deep-middle target between the opposite service line and baseline; keep spare balls outside the movement lane.'],
    countLabel:'Ready volleys',countRule:'Count a rep when you split on the feed, make a compact volley into the chosen target and finish balanced. A missed target, late split or running contact is a miss.',
    easier:'Stay in place, use gentle feeds to a known side and aim for the full singles court. Build balance before closing forward.',
    advance:'Try Add pressure after two rounds of 7/10 or better with compact contact. Add variation before adding pace.',
    versions:[
      {id:'control',label:'Build control',rounds:3,reps:10,focus:'Arrive balanced for the first volley.',steps:['From near the service line, take two small closing steps. Split as the feeder makes contact and keep the racket in front.','The feeder sends five gentle forehand volleys and five backhand volleys. Volley to the chosen deep-middle target.','Count ready volleys out of ten. Reset behind your starting mark after each rep; switch roles and rest after the round.','Repeat for three rounds each. Keep the swing short and use placement rather than a hard finish.']},
      {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep the first volley calm when the side is unknown.',steps:['Keep the same starting mark and target. Close and split on the feeder’s contact.','Let the feeder choose either side for ten controlled feeds. Read the ball before choosing the volley; do not guess.','Count ready volleys out of ten. Reset each rep, then switch roles and rest for 30–45 seconds.','Repeat for three rounds each. If contact becomes a running swing, return to predictable feeds.']},
    ],
  },
  '30-30-pressure-game':{
    players:2,
    setup:['Play singles with a partner on a full court. Agree on a five-word opening plan before each point.','Use ten separate pressure points per round. Reset the practice score before each point; these are situation reps, not a recorded match.'],
    countLabel:'Plans followed',countRule:'Count a point when you call a plan, choose a sensible first-ball target and reset before the next point. Winning is not required; do not force an attack when the ball calls for defense.',
    easier:'Use a cooperative second serve and a large crosscourt or middle target. Keep the plan and reset even when the rally is short.',
    advance:'Try Add pressure after two rounds of 7/10 or better. Keep point wins separate from following the plan.',
    versions:[
      {id:'control',label:'Build control',rounds:2,reps:10,focus:'Keep your plan and reset steady at 30–30.',steps:['Start each point at 30–30. Say a realistic opening plan in five words or fewer before the serve.','Play five points as server, then five as returner. Use normal serves and reset the practice score after every point.','Count plans followed out of ten, including lost points with good decisions. Rest for 45 seconds.','Play a second round. Compare routine and decision quality; keep wins separate from the drill count.']},
      {id:'pressure',label:'Add pressure',rounds:2,reps:10,focus:'Make a clear first-ball choice when behind.',steps:['Start your five serving points at 30–40 and your five returning points at 40–30. Reset the practice score before every point.','Call the opening plan before the serve. Adjust if the ball forces defense instead of trying to prove the plan with a risky winner.','Count plans followed out of ten. Include a calm reset after wins and losses, then rest for 45 seconds.','Play a second round. Step back to 30–30 reps if the score changes your routine or target discipline.']},
    ],
  },
}

export function drillPlaybook(cardId:string):DrillPlaybook|undefined{return Object.hasOwn(playbooks,cardId)?playbooks[cardId]:undefined}
