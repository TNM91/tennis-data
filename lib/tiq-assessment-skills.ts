export const tiqSkillLevels = ['Learning', 'Building', 'Steady', 'Under pressure'] as const

export const tiqSkills = [
  { id: 'serve', skill: 'Serve', drill: { id: 'serve-target-call', title: 'Serve Target Call' },
    target: 'Call a target before each second serve. Record how many of ten land in.',
    check: 'Hit ten second serves, five to each box. Count serves in and watch whether the player can call a target.',
    levels: ['Learning to start points with a serve.', 'Serves into both boxes at an easy pace.', 'Trusts the second serve at match pace.', 'Varies first-serve targets and places the second serve under pressure.'] },
  { id: 'return', skill: 'Return', drill: { id: 'return-depth-lane', title: 'Return Depth Lane' },
    target: 'Return ten serves and count how many land past the service line.',
    check: 'Return five first serves and five second serves. Count balls in play and watch for a deliberate target.',
    levels: ['Learning to get returns in play.', 'Returns slower serves with a compact swing.', 'Neutralizes first serves and aims second-serve returns.', 'Adjusts position and target to the server and score.'] },
  { id: 'rally', skill: 'Baseline rally', drill: { id: 'wall-rally-rhythm', title: 'Wall Rally Rhythm' },
    target: 'Track your longest controlled rally on each wing.',
    check: 'Rally crosscourt on both wings. Track how many balls the player keeps in with depth and margin.',
    levels: ['Learning to keep a ball in play.', 'Sustains an easy baseline rally.', 'Directs both wings with margin at match pace.', 'Varies depth, pace, and direction consistently under pressure.'] },
  { id: 'movement', skill: 'Movement', drill: { id: 'split-step-rhythm', title: 'Split-Step Rhythm' },
    target: 'Split-step before the feed and get balanced for the next ball on each rep.',
    check: 'Alternate wide and deep feeds. Watch the split step, balance at contact, and recovery for the next ball.',
    levels: ['Often reaches or arrives late.', 'Gets into position for predictable feeds.', 'Split-steps and recovers between most balls.', 'Recovers efficiently after wide and deep balls under pressure.'] },
  { id: 'net', skill: 'Net play', drill: { id: 'volley-ready-split', title: 'Volley Ready Split' },
    target: 'Choose a target for the first volley and count how often you hit it in ten reps.',
    check: 'Play ten approach-and-volley reps. Mix low balls with a lob and watch the first volley and coverage.',
    levels: ['Learning the basic volley.', 'Blocks an easy volley back in play.', 'Chooses an approach and places the first volley.', 'Handles low or fast volleys and reads when to close or cover the lob.'] },
  { id: 'points', skill: 'Point decisions', drill: { id: '30-30-pressure-game', title: '30–30 Pressure Game' },
    target: 'Start at 30–30. Call your opening pattern before each point and track how often you use it.',
    check: 'Start points at 30–30. Ask the player to call a pattern and watch when they defend, rally, or attack.',
    levels: ['Learning how to build a point.', 'Keeps the ball in play and recovers.', 'Recognizes when to defend, rally, or attack.', 'Adjusts the pattern to the opponent while keeping targets under pressure.'] },
] as const

export type TiqSkillId = typeof tiqSkills[number]['id']
