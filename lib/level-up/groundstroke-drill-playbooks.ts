import type {DrillPlaybook} from './drill-playbooks'

// Original practice formats. Counts track the player's own task, not match wins.
export const GROUNDSTROKE_DRILL_PLAYBOOKS:Record<string,DrillPlaybook>={
 'basket-forehand-crosscourt':{
  players:1,
  rest:{seconds:45,guidance:'30–45 seconds between rounds.'},
  setup:['Use a full court, racket and ten balls. Put the basket outside your movement lane.','Choose a forehand starting spot near your baseline and a diagonal target inside the opposite singles sideline, between the service line and baseline. Mark a nearby ready spot without placing a cone underfoot.'],
  countLabel:'Controlled forehands',countRule:'Count a self-fed forehand when it lands in the chosen crosscourt target and you finish balanced, then recover to your ready spot. Each attempted hit is one rep; a miss stays in the ten.',
  easier:'Use gentle drop feeds and the whole diagonal half of the singles court. Keep a balanced finish before narrowing the target.',
  advance:'Try Add pressure after two rounds of 7/10 or better. Keep the same target and starting spot when comparing rounds; this is a practice goal, not a rating.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Connect crosscourt shape with a balanced recovery.',steps:['Drop-feed one ball to your forehand and hit after the bounce toward the deep diagonal target. Leave comfortable clearance over the net.','Recover to your ready spot before taking the next ball. Make ten separate attempts; do not erase misses.','Record controlled forehands out of ten. Collect balls only when the court is clear, then rest for 30–45 seconds.','Repeat for three rounds. Self-feeds rehearse contact and recovery; they do not test reading an incoming rally ball.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep the crosscourt target when the starting position changes.',steps:['Keep the same deep diagonal target. Before each self-feed, take one controlled adjustment step left or right within your forehand area.','Set your feet, drop-feed and hit after the bounce. Recover to the same ready spot; make ten attempts without rushing.','Count only target hits with balance and recovery. Rest and collect safely after the round; a miss is not a restart.','Repeat for three rounds. Return to a fixed starting spot if the adjustment makes contact late or stretched.']},
  ],
 },
 'basket-backhand-crosscourt':{
  players:1,
  rest:{seconds:45,guidance:'30–45 seconds between rounds.'},
  setup:['Use a full court, racket and ten balls. Keep the basket and loose balls outside your steps.','Choose a backhand starting spot near your baseline and a diagonal target inside the opposite singles sideline, between the service line and baseline. Choose a nearby ready spot suited to that target.'],
  countLabel:'Controlled backhands',countRule:'Count a self-fed backhand when you prepare the turn, land in the chosen crosscourt target and recover in balance. Count every attempted hit, including misses; do not restart the ten.',
  easier:'Use a gentle drop feed and a larger diagonal target. Rehearse the turn without a ball first if spacing is difficult.',
  advance:'Try Add pressure after two rounds of 7/10 or better with the same target. Compare self-fed rounds with self-fed rounds, not live-rally results.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Prepare the backhand before chasing depth.',steps:['Prepare your turn, drop-feed to the backhand side and hit after the bounce. Aim deep crosscourt with room inside the lines.','Return to your ready spot before the next ball. Make ten attempts using your normal one- or two-handed backhand.','Record controlled backhands out of ten, including misses in the attempts. Collect safely and rest for 30–45 seconds.','Repeat for three rounds. Keep spacing and recovery steady before increasing pace.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Keep preparation when a small adjustment changes the contact position.',steps:['Keep the target and ready spot. Take one controlled adjustment step within your backhand area before preparing each drop feed.','Hit after the bounce and recover in balance. Make ten attempts; do not turn a late feed into a hurried swing.','Count target hits with preparation and recovery. A miss remains a miss; collect safely and rest after the round.','Repeat for three rounds. Remove the adjustment step if preparation or spacing breaks down.']},
  ],
 },
 'crosscourt-consistency':{
  players:2,
  rest:{seconds:45,guidance:'30–45 seconds between rounds.'},
  setup:['Two players rally in a diagonal singles lane, with targets inside the sidelines and beyond the service lines. Keep the pace cooperative.','Choose which diagonal to use and a ready position for each player. Agree on height and depth margin; each player records their own contacts, not a combined rally score.'],
  countLabel:'Controlled rally balls',countRule:'Count your own contact when it lands deep in the agreed crosscourt lane and you recover ready. Your miss uses an attempt; your partner’s miss does not. Restart the rally as needed without erasing your count.',
  easier:'Rally from closer positions with a larger target and comfortable pace. Use the same positions for both rounds you compare.',
  advance:'Try Add pressure after two rounds of 7/10 or better. Change one condition at a time and keep each player’s counts separate.',
  versions:[
   {id:'control',label:'Build control',rounds:3,reps:10,focus:'Build a repeatable diagonal rally with margin.',steps:['Start with a cooperative feed and rally crosscourt to the agreed deep target. Use the stroke that suits your side and handedness.','Count ten of your own attempted contacts. Keep your tally after a miss; a partner miss simply starts a new rally.','Record controlled rally balls out of ten. Both players finish their own ten attempts, then rest for 30–45 seconds.','Repeat for three rounds. Stay in the diagonal lane rather than changing direction to finish the rally.']},
   {id:'pressure',label:'Add pressure',rounds:3,reps:10,focus:'Hold the same lane while a partner varies depth.',steps:['One partner varies depth within the diagonal lane at a pace the other can control. Keep a clear deep target for the player being counted.','That player makes ten contact attempts, adapting spacing and recovering after each. Do not force an attack on a short or awkward ball.','Record controlled rally balls out of ten, then swap the player being counted. Misses stay in each player’s count.','Repeat for three rounds each, resting after both players finish. Return to predictable depth if the rally becomes a chase.']},
  ],
 },
 'defense-neutral-attack-rally':{
  players:2,
  rest:{seconds:45,guidance:'45 seconds between rounds.'},
  setup:['One player practices decisions; the partner starts from the opposite baseline and provides controlled, reachable balls. Choose large targets inside the singles court.','Each attempt is a sequence of up to three player contacts: recover from a wide ball, build from balance, then read the next ball. Stop if a shot is missed; never force a sprint or an attack.'],
  countLabel:'Well-chosen sequences',countRule:'Count a sequence only when your defend, build or attack calls fit your balance and the ball, your shots stay inside the agreed court targets and you recover ready. Staying defensive or neutral can be correct. A player miss ends the attempt; replace an unplayable partner feed.',
  easier:'Use predictable reachable feeds and stop after the first recovery ball. Add the next contact only when you can recover without rushing.',
  advance:'Try Add pressure after two rounds of 7/10 or better. Progress the decision challenge before adding pace; sequence counts are not point wins.',
  versions:[
   {id:'control',label:'Build control',rounds:2,reps:10,focus:'Recover from defense before looking to attack.',steps:['The partner starts with a reachable wide feed. Call defend and send a higher, safer ball toward a large deep-middle target, then recover.','The partner returns a predictable neutral ball, then a comfortable shorter ball if the sequence continues. Call build or attack before each shot; stay neutral if you are not balanced.','Stop after your third contact or a player miss. Make ten sequences, recording those with sensible choices, in-court shots and recovery.','Swap roles for ten sequences, rest for 45 seconds and repeat for two rounds each. Replace an unplayable feed without counting an attempt.']},
   {id:'pressure',label:'Add pressure',rounds:2,reps:10,focus:'Read the ball instead of assuming the third shot is an attack.',steps:['Start with the same reachable wide feed and recovery ball. Keep the partner’s pace controlled.','For the next two player contacts, the partner varies depth. Call defend, build or attack from what you can play in balance; a shorter ball does not require an attack.','End after three player contacts or a player miss. Count well-chosen sequences out of ten; staying neutral can earn the count.','Swap roles, rest and repeat for two rounds each. Return to predictable depth if the calls become guesses or the movement is rushed.']},
  ],
 },
 'return-plus-one-recover':{
  players:2,
  rest:{seconds:45,guidance:'45 seconds between rounds.'},
  setup:['Use a server and returner on a full singles court. Agree on a deep return target and a large target for the returner’s next groundstroke.','The same partner serves and plays the next reply. One attempt is the return plus the returner’s next shot; stop after those two returner contacts. Keep spare balls clear.'],
  countLabel:'Connected return starts',countRule:'Count a sequence when the return reaches the named target, you recover and split on the partner’s next contact, and your next shot lands in its target from balance. A missed player shot is a miss; replace serve faults or unplayable partner replies.',
  easier:'Start with a gentle racket feed, then a predictable reply. This rehearses the pattern without claiming a live-serve result.',
  advance:'Try Add pressure after two rounds of 7/10 or better at the same serve pace and target size. These are the returner’s first two shots, not the server’s serve-plus-one.',
  versions:[
   {id:'control',label:'Build control',rounds:2,reps:10,focus:'Be ready for the ball after the return.',steps:['The partner uses a controlled second serve. Return toward the named deep target, then recover before watching the result.','Split on the partner’s reply and play your next groundstroke toward the agreed large target. The partner keeps that reply predictable and reachable.','Stop after your second shot or a player miss. Make five valid-serve starts from each receiving side; serve faults and unplayable partner replies are replaced.','Record connected return starts out of ten. Swap roles, rest for 45 seconds and repeat for two rounds each.']},
   {id:'pressure',label:'Add pressure',rounds:2,reps:10,focus:'Recover when the serve and next reply change location.',steps:['Keep the same targets. Let the server vary serve location and choose either side for the next reachable reply, at a pace you can manage.','Return, recover and split on the reply. Adjust to the ball before choosing your next shot; do not guess the side.','Make five valid-serve starts from each receiving side. Count a connected start only when both shots and the recovery meet the rule.','Swap roles, rest and repeat for two rounds each. Return to predictable replies if the second contact is rushed.']},
  ],
 },
 'approach-volley-close':{
  players:2,
  rest:{seconds:45,guidance:'45 seconds between rounds.'},
  setup:['The player begins near the baseline; a partner on the opposite baseline starts each sequence with a comfortable short feed. Agree on a deep approach target and a large first-volley target.','The partner replies to the approach with a controlled, reachable ball. Stop after the first volley. Keep balls and markers outside the player’s path toward the net.'],
  countLabel:'Connected net approaches',countRule:'Count a sequence when the approach lands in its target, you close in balance and split on the partner’s contact, then land the first volley in its target. A missed player shot ends the attempt; replace an unplayable partner feed or reply.',
  easier:'Rehearse the approach and close without a ball, then use a predictable gentle feed and a larger volley target. Add the reply only when the steps connect.',
  advance:'Try Add pressure after two rounds of 7/10 or better. Vary the first-volley side before adding pace; a count is a connected pattern, not a point won.',
  versions:[
   {id:'control',label:'Build control',rounds:2,reps:10,focus:'Connect the approach, close and balanced first volley.',steps:['Move to the short feed and approach toward the agreed deep target. Follow forward without sprinting past the position where you can stop in balance.','Split as the partner strikes the predictable reply, then volley toward the named large target. Do not keep running through contact.','Stop after the first volley or a player miss. Reset near the baseline for ten sequences, replacing unplayable partner feeds or replies.','Record connected net approaches out of ten. Swap roles, rest for 45 seconds and repeat for two rounds each.']},
   {id:'pressure',label:'Add pressure',rounds:2,reps:10,focus:'Read the reply while keeping the close under control.',steps:['Keep a comfortable short starting feed and the same approach target. Close forward in balance after the approach.','The partner varies the reachable reply to either volley side. Split on their contact, then choose the volley; the side is not called in advance.','End after the first volley or a player miss. Count ten sequences without treating an approach winner or an unusable partner reply as a completed volley pattern.','Swap roles, rest and repeat for two rounds each. Use predictable replies again if you guess, rush the close or volley while running.']},
  ],
 },
}
