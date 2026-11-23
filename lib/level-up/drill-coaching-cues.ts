import type {LevelUpCard} from './level-up-types'

type DrillCoachingCues=Required<Pick<LevelUpCard,'qualityChecks'|'commonMiss'>>

// Original practice guidance. The playbook's count rule remains the scoring rule.
const cues:Record<string,DrillCoachingCues>={
 'serve-target-ladder':{
  qualityChecks:['Call the next zone before the motion.','Use the diagonal service box for the side you are serving from.','Keep the target order and tally after a miss.'],
  commonMiss:{miss:'You restart the target pattern after a fault or chase pace instead of the called zone.',fix:'Keep the miss in the ten and move to the next zone. Use larger targets or return to five serves per side when the routine becomes rushed.'},
 },
 'second-serve-routine-reps':{
  qualityChecks:['Breathe and choose a target before starting the motion.','Finish balanced from a legal starting position.','Use the same calm reset after a make or a miss.'],
  commonMiss:{miss:'A missed serve changes your next routine into a hurried correction.',fix:'Pause, breathe and name the next target before serving again. Count the routine separately from the landing result; do not erase the missed attempt.'},
 },
 'volley-punch-target':{
  qualityChecks:['Choose the target before the feed.','Use a compact stroke with the racket ready in front.','Finish balanced and reset before the next feed.'],
  commonMiss:{miss:'You swing at the volley or keep moving forward until the next feed rushes you.',fix:'Use gentle feeds to a known side and a larger target. Reset in balance instead of automatically stepping closer to the net.'},
 },
 'reaction-volley-wall':{
  qualityChecks:['Use a soft start and a distance that gives you time.','Meet the rebound before the bounce with a compact stroke into the window.','Reset your racket and balance before the next counted contact.'],
  commonMiss:{miss:'The rebound gets faster and you reach or make a longer swing to keep it going.',fix:'Soften the starting ball or catch and reset whenever the rebound rushes you. Keep the misses in your tally; do not move closer to force faster contacts.'},
 },
 'serve-target-call':{
  qualityChecks:['Call the diagonal service-box target before starting your motion.','Keep the same breath and bounce routine after a make or a miss.','Use a pace that lets you aim and finish in balance.'],
  commonMiss:{miss:'You speed up after a fault and start serving before choosing the next target.',fix:'Pause behind the baseline, name the target and repeat your routine. Keep the fault in the count; do not add a replacement serve.'},
 },
 'return-depth-lane':{
  qualityChecks:['Choose the deep lane before the server starts.','Use a compact return with margin into the chosen lane.','Recover to ready instead of watching where the return lands.'],
  commonMiss:{miss:'You make the return but leave it short or stop to watch it.',fix:'Use a larger deep target and controlled second serves. Count the return only when the depth, lane and recovery all meet the rule.'},
 },
 'wall-rally-rhythm':{
  qualityChecks:['Keep the same wall window and starting distance for the round.','Give yourself space for the bounce instead of crowding the rebound.','Reset your feet in balance between contacts.'],
  commonMiss:{miss:'The ball gets faster and you reach for the next contact without resetting.',fix:'Slow down or drop-hit, catch and reset. A miss stays in your ten attempts; restarting the rally does not restart the count.'},
 },
 'split-step-rhythm':{
  qualityChecks:['Time a small split with the contact cue.','Land softly enough to move either way.','Choose the first move after the cue, then recover in balance.'],
  commonMiss:{miss:'You guess the direction before the partner cue or make a large hop that delays the first step.',fix:'Use a smaller split and a controlled first move. Without a partner, choose Build control and treat it as timing rehearsal rather than a reaction test.'},
 },
 'volley-ready-split':{
  qualityChecks:['Close under control and split as the feeder makes contact.','Keep the racket in front and the volley swing compact.','Finish the volley balanced with the ball in the named target.'],
  commonMiss:{miss:'You keep running through the volley or guess the feed side.',fix:'Return to gentle feeds to a known side. Close, split on the feed and then choose the volley; do not add speed until that sequence is calm.'},
 },
 '30-30-pressure-game':{
  qualityChecks:['Say a realistic opening plan before each point.','Choose the first ball from your balance and the ball you receive.','Use the same reset after winning and losing a point.'],
  commonMiss:{miss:'You force a winner to prove the plan when the ball calls for defense.',fix:'Choose the safer first ball and reset. A lost point can still follow the plan; keep point wins separate from the drill count.'},
 },
 'basket-forehand-crosscourt':{
  qualityChecks:['Leave height and sideline margin into the deep diagonal target.','Set up far enough from the bounce to swing without reaching.','Recover to your ready spot after contact.'],
  commonMiss:{miss:'You hit harder while the target and recovery disappear.',fix:'Use a slower drop feed and a larger target. Finish in balance and recover before the next feed; keep missed attempts in the ten.'},
 },
 'basket-backhand-crosscourt':{
  qualityChecks:['Prepare your turn before the drop feed reaches its bounce.','Keep comfortable spacing for your own backhand style.','Recover after contact while keeping margin into the diagonal target.'],
  commonMiss:{miss:'You steer a late backhand and freeze to see where it lands.',fix:'Remove the adjustment step and rehearse the turn with a slower drop feed. Count the shot only when the target, preparation and recovery all hold.'},
 },
 'crosscourt-consistency':{
  qualityChecks:['Keep height and depth margin in the agreed diagonal lane.','Adjust your spacing before contact and recover ready.','Track your own contacts separately from your partner’s.'],
  commonMiss:{miss:'You restart your tally after a miss or turn the drill into an open rally.',fix:'Keep the diagonal target and your existing tally. Your miss uses an attempt; your partner’s miss starts another rally without adding an attempt for you.'},
 },
 'defense-neutral-attack-rally':{
  qualityChecks:['Use the first defensive ball to buy recovery time.','Call defend, build or attack from the ball and your balance.','Stay neutral when you have not earned an attacking position.'],
  commonMiss:{miss:'You assume the third ball must be an attack, even when you are stretched.',fix:'Read each ball and choose the shot you can play in balance. A well-chosen neutral sequence can count; an attack is not required.'},
 },
 'return-plus-one-recover':{
  qualityChecks:['Send the return toward the named deep target.','Recover and split on the server’s next contact.','Play the next groundstroke from balance into its target.'],
  commonMiss:{miss:'You watch the return and arrive late for your next shot.',fix:'Use a controlled serve and predictable reply, recovering straight after the return. Count the two-shot connection only when both targets and recovery hold.'},
 },
 'approach-volley-close':{
  qualityChecks:['Place the approach into the agreed target before closing.','Split on the partner’s contact rather than running through it.','Read the reply and volley from balance into the named target.'],
  commonMiss:{miss:'You rush forward and contact the volley while still running.',fix:'Slow the starting feed and use a predictable reply. Close only as far as you can stop in balance, then split before choosing the volley.'},
 },
 'serve-1-partner':{
  qualityChecks:['Name the serve zone and first-groundstroke target before serving.','Recover after the serve and read the actual return.','Finish the first groundstroke and recovery in balance.'],
  commonMiss:{miss:'You watch a good serve and rush the first groundstroke.',fix:'Use a comfortable second serve and a predictable middle return. A serve fault stays a miss; repeat a net or out return that never offers the first groundstroke.'},
 },
 'serve-location-call':{
  qualityChecks:['Both serving partners acknowledge the serve zone and hold or cross plan.','The net player follows the agreed first move.','The server covers the half the net player leaves.'],
  commonMiss:{miss:'Both serving players follow the same path and leave a half uncovered.',fix:'Walk the cross and cover without a ball, then use a cooperative return. Count the coordinated start separately from the volley or point result.'},
 },
 'doubles-return-first-move':{
  qualityChecks:['Keep the designated receiver on the same receiving side for the block.','Name the deep return target before the serve.','Let the partner’s next move match the return quality and shared coverage.'],
  commonMiss:{miss:'The receiver’s partner charges forward behind a short return.',fix:'Hold and prepare to defend the weaker return; move forward only when the return supports it. A missed return or uncovered half stays a miss.'},
 },
 'middle-ball-rule':{
  qualityChecks:['Agree on the neutral-middle owner before feeding.','Make one early mine call and leave space for one hitter.','Recover together with the next ball covered.'],
  commonMiss:{miss:'Both partners swing or assume one forehand always owns the middle.',fix:'Stop and agree on ownership for your positions and handedness. Use predictable feeds and one early caller before adding variation.'},
 },
 'switch-call-drill':{
  qualityChecks:['Choose switch or stay from the playable feed.','On a switch, the retriever turns and moves behind the partner.','Finish balanced with one player covering each half.'],
  commonMiss:{miss:'You call switch automatically or cross into your partner’s retrieval path.',fix:'Walk the paths with a predictable lob and call early. Staying can be correct; rally coverage does not change your designated receiving sides.'},
 },
 'poach-timing-shadow':{
  qualityChecks:['Agree on hold, fake or cross before the imaginary serve.','Respond to the return-swing cue rather than the serve toss.','Finish with a safe gap and the server covering the correct half.'],
  commonMiss:{miss:'The net player moves on the toss or the server follows the same crossing path.',fix:'Walk the sequence with pauses at serve, return cue and recovery. Keep both versions free of live balls; these counts describe rehearsals, not volleys.'},
 },
}

export function drillCoachingCues(cardId:string):DrillCoachingCues|undefined{
 return Object.hasOwn(cues,cardId)?cues[cardId]:undefined
}
