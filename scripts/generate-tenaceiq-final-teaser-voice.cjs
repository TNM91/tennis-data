/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const repo = process.cwd()
const { EdgeTTS } = require(path.join(repo, 'artifacts', 'usta-walkthrough-2026-08-13', 'revision-2', 'neural-tts-tool-2', 'node_modules', 'node-edge-tts'))
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14', 'premium-v4-final', 'teaser')
const outputDir = path.join(root, 'audio', 'narration')
const phrases = [
  'What if every tennis decision felt clearer?',
  'Start free. Add the role you need, from Player to Club.',
  'One connected platform to play, improve, lead, and organize.',
  'Ten Ace I Q. More tennis. Less chaos.',
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
    console.log(`Generated teaser narration ${number}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
