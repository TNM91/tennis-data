/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const repo = process.cwd()
const { EdgeTTS } = require(path.join(repo, 'artifacts', 'usta-walkthrough-2026-08-13', 'revision-2', 'neural-tts-tool-2', 'node_modules', 'node-edge-tts'))
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14')

const scripts = {
  '30s': [
    'Meet Ten Ace I Q. Tennis decisions, made clearer.',
    'Explore tennis, then personalize your game in My Lab.',
    'Prepare smarter, practice with purpose, and know what comes next.',
    'Coaches guide progress. Captains simplify match week.',
    'Organizers manage schedules, scores, standings, tournaments, and stronger data.',
    'Start free at ten ace I Q dot com. More tennis. Less chaos.',
  ],
  '15s': [
    'Meet Ten Ace I Q. Tennis decisions, made clearer.',
    'Explore, prepare smarter, and run teams and leagues with less chaos.',
    'Start free at ten ace I Q dot com. More tennis. Less chaos.',
  ],
}

async function main() {
  const tts = new EdgeTTS({
    voice: 'en-US-AriaNeural',
    lang: 'en-US',
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    pitch: '+1Hz',
    rate: '-3%',
    volume: 'default',
    timeout: 30000,
  })

  for (const [name, phrases] of Object.entries(scripts)) {
    const outputDir = path.join(root, 'audio', `narration-${name}`)
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(root, `narration-${name}.json`), JSON.stringify(phrases, null, 2))
    for (let index = 0; index < phrases.length; index += 1) {
      const number = String(index + 1).padStart(2, '0')
      const output = path.join(outputDir, `narration-${number}.mp3`)
      await tts.ttsPromise(phrases[index], output)
      console.log(`Generated ${name} narration ${number}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
