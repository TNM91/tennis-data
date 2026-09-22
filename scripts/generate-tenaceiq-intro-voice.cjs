/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const repo = process.cwd()
const { EdgeTTS } = require(path.join(
  repo,
  'artifacts',
  'usta-walkthrough-2026-08-13',
  'revision-2',
  'neural-tts-tool-2',
  'node_modules',
  'node-edge-tts',
))

const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14')
const outputDir = path.join(root, 'audio', 'narration')
fs.mkdirSync(outputDir, { recursive: true })

const phrases = [
  'Tennis gives you plenty to think about. Finding the right information should not be one of them. Meet Ten Ace I Q: tennis decisions, made clearer.',
  'Start free. Search players, teams, leagues, rankings, and tournaments, all in one connected place.',
  'Make it personal with My Lab. Keep your player record, recent results, goals, and next tennis move together.',
  'Prepare smarter with matchup insights, then turn what you learn into focused practice with Level Up and Tactics Tools.',
  'Coaches can plan lessons, assign drills, review video, and keep every player moving toward a useful next step.',
  'Captains can check availability, compare lineups, scout the competition, and send a match-week plan the team can trust.',
  'League coordinators and organizers can manage participants, schedules, scores, standings, and tournaments with less spreadsheet cleanup.',
  'And Data Assist helps keep results, rosters, and schedules accurate, because better data creates better tools for everyone.',
  'Explore for free, then add the tools that fit your tennis life. Ten Ace I Q. More tennis. Less chaos. Visit ten ace I Q dot com, and make your next decision clearer.',
]

async function main() {
  fs.writeFileSync(path.join(root, 'narration.json'), JSON.stringify(phrases, null, 2))
  const tts = new EdgeTTS({
    voice: 'en-US-AriaNeural',
    lang: 'en-US',
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    pitch: '+1Hz',
    rate: '-3%',
    volume: 'default',
    timeout: 30000,
  })

  for (let index = 0; index < phrases.length; index += 1) {
    const number = String(index + 1).padStart(2, '0')
    const output = path.join(outputDir, `narration-${number}.mp3`)
    if (fs.existsSync(output) && fs.statSync(output).size > 1024) {
      console.log(`Keeping narration-${number}.mp3`)
      continue
    }
    await tts.ttsPromise(phrases[index], output)
    console.log(`Generated narration-${number}.mp3`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
