/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const repo = process.cwd()
const { EdgeTTS } = require(path.join(repo, 'artifacts', 'usta-walkthrough-2026-08-13', 'revision-2', 'neural-tts-tool-2', 'node_modules', 'node-edge-tts'))
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14', 'premium-v4-final')
const outputDir = path.join(root, 'audio', 'narration')

const phrases = [
  'Tennis already gives you enough to think about. Ten Ace I Q helps make the next decision a whole lot clearer.',
  'You can start free, then choose the tools that fit your tennis life: Player, Coach, Captain, League, Full-Court, or Club.',
  'Need an answer? Explore players, teams, leagues, rankings, and tournaments in one place.',
  'When it is your game, Player brings everything together in My Lab, with matchup prep, Level Up, and tactics tools built around you.',
  'If you are coaching, plan the lesson, assign the next piece of work, review progress, and keep every player moving between sessions.',
  'Captaining a team? See who is ready, compare lineups, scout the matchup, and send one plan everyone understands.',
  'Running a league or tournament? Manage schedules, scores, standings, and events without turning every update into spreadsheet cleanup.',
  'Wearing more than one hat? Full-Court keeps your player, coach, captain, and organizer tools connected.',
  'Running a club? Bring staff, players, programs, teams, leagues, and tournaments into one branded, connected experience.',
  'And when members share trusted uploads, Data Assist keeps results, rosters, and schedules current. Every contribution makes Ten Ace I Q more useful for the entire tennis community.',
  'Start free. Add only what helps. Ten Ace I Q. More tennis. Less chaos.',
]

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(root, 'narration.json'), JSON.stringify(phrases, null, 2))
  const tts = new EdgeTTS({
    voice: 'en-US-AvaNeural',
    lang: 'en-US',
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    pitch: '+0Hz',
    rate: '+6%',
    volume: 'default',
    timeout: 30000,
  })
  for (let index = 0; index < phrases.length; index += 1) {
    const number = String(index + 1).padStart(2, '0')
    await tts.ttsPromise(phrases[index], path.join(outputDir, `narration-${number}.mp3`))
    console.log(`Generated final-master narration ${number}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
