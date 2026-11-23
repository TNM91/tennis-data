import type {DrillPlaybook} from './drill-playbooks'

// Original TenAceIQ formats. Volley contacts are practice counts, not point wins.
export const NET_DRILL_PLAYBOOKS:Record<string,DrillPlaybook>={
 'volley-punch-target':{
  players:2,
  setup:['Use a court, two rackets and ten balls. The volleyer starts between the service line and net with room to finish balanced; a cooperative feeder stands across the net.','Choose one large deep-middle target between the opposite service line and baseline. Keep spare balls and markers outside both players’ paths.'],
  countLabel:'Placed volleys',countRule:'Count a volley when you contact the feed before the bounce, use a compact stroke into the chosen target and reset balanced. A bounce, missed target or running contact is a miss. Repeat a feed that is net, out or outside the agreed reach.',
  easier:'Use gentle feeds to a known side and a larger in-court target. Reset in place between feeds instead of adding a forward move.',
  advance:'Try Add pressure after two rounds of 7/10 placed volleys. Keep the same target and manageable feed pace; vary the side before adding speed.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Place the volley with a short stroke and a balanced reset.',steps:['Name the deep-middle target and get the racket ready in front. The feeder sends five gentle forehand feeds, then five backhand feeds.','Contact each playable feed before the bounce with a compact volley. Reset to ready; do not take an automatic step toward the net after every shot.','Record placed volleys out of ten playable feeds. Keep misses in the ten, repeating only feeds outside the agreed reach.','Switch feeder and volleyer, collect safely and rest for 30–45 seconds. Complete three rounds each with the same target.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep placement when the volley side and height vary.',steps:['Keep the same target and starting position. The feeder varies forehand and backhand sides and reachable feed heights at a cooperative pace.','Read the feed before choosing the volley. Keep the stroke short and finish balanced instead of guessing or chasing forward.','Count placed volleys out of ten playable feeds. A missed target, bounce or loss of balance stays a miss; replace an unusable feed.','Switch roles, rest and complete three rounds each. Return to a known feed side if the stroke grows or the next feed feels rushed.']},
  ],
 },
 'reaction-volley-wall':{
  players:1,
  setup:['Use a tennis practice wall, a racket and one ball, with clear, dry rebound space and nobody in the hitting area. Choose a visible window above the wall’s net line.','Stand at a comfortable distance for a soft rebound volley without rushing or reaching. A gentle starting shot sends the ball to the wall; that starting shot is not a counted attempt.'],
  countLabel:'Controlled wall volleys',countRule:'Count a rebound volley when you contact it before the bounce, send it into the chosen window with a compact stroke and reset balanced. A missed volley, bounce or missed window is a miss. Starting shots and deliberate reset catches are not attempts.',
  easier:'Use a softer starting ball, a bigger window and one rebound volley followed by a catch and reset. Choose space and pace that give you time; do not move closer to force faster contacts.',
  advance:'Try Add pressure after two rounds of 8/10 controlled wall volleys. Keep the window and wall distance the same. Alternating sides rehearses control; it is not a measured reaction-time test.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Make one calm rebound volley, then reset.',steps:['Gently send the ball to the wall and volley the first rebound before it bounces, aiming for your window. The starting shot is unscored.','Catch safely after that volley and reset. Make five forehand rebound attempts, then five backhand rebound attempts; count a missed volley as an attempt.','Record controlled wall volleys out of ten. Keep the same distance and window, and rest for 30 seconds after the round.','Complete three rounds. Soften the starting shot or return to a single contact if you reach, swing or lose balance.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Alternate volley sides without growing the swing.',steps:['Use the same window and distance. Start softly with an unscored shot, then alternate forehand and backhand rebound volleys before the bounce.','Make ten rebound-volley attempts, including misses. After a miss or a ball that bounces, catch safely and restart without erasing the tally.','Count contacts that meet the window, compact-stroke and balanced-reset rule. A longer rally does not erase earlier misses; rest for 30 seconds after ten attempts.','Complete three rounds. Return to single-rebound catch-and-reset work if the ball rushes you; never chase an unsafe rebound.']},
  ],
 },
}
