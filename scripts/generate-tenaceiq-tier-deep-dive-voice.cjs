/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const repo = process.cwd()
const { EdgeTTS } = require(path.join(repo, 'artifacts', 'usta-walkthrough-2026-08-13', 'revision-2', 'neural-tts-tool-2', 'node_modules', 'node-edge-tts'))
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14', 'tier-deep-dives')

const scripts = {
  free: [
    'Start with Free when you want the whole tennis world in one clear view.',
    'Search players, teams, leagues, rankings, coaches, and tournaments, then use public context to understand what you are seeing.',
    'Free gives you useful answers now, and a clear place to decide what to unlock next.',
  ],
  player: [
    'Player is where your tennis becomes personal, with one home for the information that helps your game.',
    'Use My Lab, prepare for matchups, follow your Level Up work, and keep tactics connected to the player you are becoming.',
    'Instead of staring at match history, leave with a clearer next move for practice and competition.',
  ],
  coach: [
    'Coach helps you keep player development moving between lessons, not just while you are on court.',
    'Plan the lesson, assign the next piece of work, review player proof, and track progress in one connected coaching path.',
    'Give every player a clearer next step, while keeping your follow-up organized and easy to act on.',
  ],
  captain: [
    'Captain brings the entire match week into one trusted team workflow.',
    'See who is ready, compare lineup scenarios, scout the matchup, and send a plan your players can understand.',
    'Spend less time chasing answers in group texts, and more time making the team decision with confidence.',
  ],
  league: [
    'League gives organizers one competition home for the season in front of them.',
    'Build schedules, collect scores, maintain standings, and connect league or tournament updates without another cleanup cycle.',
    'Move the competition forward with structure that players, captains, and organizers can follow.',
  ],
  'full-court': [
    'Full-Court is for the tennis person who wears more than one hat.',
    'Keep Player, Coach, Captain, League, and Tournament Desk tools connected to the same tennis identity and trusted data.',
    'Move between roles without rebuilding the context you already created somewhere else.',
  ],
  club: [
    'Club connects the people, programs, teams, and competition that make your tennis organization work.',
    'Start with one location, or scale across locations with connected staff, coaches, players, programs, leagues, and events.',
    'Deliver one branded club experience, with the structure to grow without adding more disconnected systems.',
  ],
}

async function main() {
  const tts = new EdgeTTS({
    voice: 'en-US-AvaNeural',
    lang: 'en-US',
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    pitch: '+0Hz',
    rate: '+10%',
    volume: 'default',
    timeout: 30000,
  })

  for (const [tier, phrases] of Object.entries(scripts)) {
    const outputDir = path.join(root, 'audio', tier)
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(root, `narration-${tier}.json`), JSON.stringify(phrases, null, 2))
    for (let index = 0; index < phrases.length; index += 1) {
      const number = String(index + 1).padStart(2, '0')
      await tts.ttsPromise(phrases[index], path.join(outputDir, `narration-${number}.mp3`))
      console.log(`Generated ${tier} deep-dive narration ${number}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
