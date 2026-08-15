import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const repo = process.cwd()
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14')
const captureDir = path.join(root, 'captures')
const workDir = path.join(root, 'work')
const logoPath = path.join(repo, 'public', 'brand', 'web', 'header-logo-transparent.png')

const scenes = [
  {
    id: '01-intro',
    kind: 'intro',
    eyebrow: 'MEET TENACEIQ',
    title: ['Tennis decisions,', 'made clearer.'],
    body: 'Find what matters. Understand your next move. Get back to playing.',
  },
  {
    id: '02-explore',
    capture: '02-explore.png',
    eyebrow: 'EXPLORE FOR FREE',
    title: ['Find your tennis.'],
    body: 'Players  •  Teams  •  Leagues  •  Rankings',
  },
  {
    id: '03-mylab',
    capture: '03-mylab.png',
    eyebrow: 'MY LAB',
    title: ['Make it personal.'],
    body: 'Your record  •  Your goals  •  Your next move',
  },
  {
    id: '04-matchup',
    capture: '04-matchup.png',
    eyebrow: 'MATCHUP PREP',
    title: ['Prepare before', 'match time.'],
    body: 'The edge  •  Why it leans  •  What to watch',
  },
  {
    id: '05-coach',
    capture: '05-coaches.png',
    eyebrow: 'COACH HUB',
    title: ['Give every player', 'the next step.'],
    body: 'Plan  •  Assign  •  Review  •  Follow up',
  },
  {
    id: '06-captain',
    capture: '06-captain.png',
    eyebrow: 'TEAM HUB',
    title: ['Run match week', 'with less chaos.'],
    body: 'Availability  •  Lineups  •  Scouting  •  Team plan',
  },
  {
    id: '07-league',
    capture: '07-leagues.png',
    eyebrow: 'LEAGUE OFFICE + TOURNAMENT DESK',
    title: ['Move the season.'],
    body: 'Schedules  •  Scores  •  Standings  •  Events',
  },
  {
    id: '08-data',
    capture: '08-data-assist.png',
    eyebrow: 'DATA ASSIST',
    title: ['Better data.', 'Better decisions.'],
    body: 'Scorecards  •  Rosters  •  Schedules',
  },
  {
    id: '09-outro',
    kind: 'outro',
    eyebrow: 'START FREE. ADD ONLY WHAT HELPS.',
    title: ['Make your next', 'decision clearer.'],
    body: 'More Tennis. Less Chaos.',
  },
]

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function titleLines(lines, x, startY, size = 74) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${startY + (index * (size + 10))}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="800" letter-spacing="-2">${escapeXml(line)}</text>`
  )).join('')
}

function baseDefs() {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#06111f"/>
        <stop offset="0.55" stop-color="#0a1b31"/>
        <stop offset="1" stop-color="#06121e"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#9be11d" stop-opacity="0.22"/>
        <stop offset="1" stop-color="#9be11d" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="62" height="62" patternUnits="userSpaceOnUse">
        <path d="M 62 0 L 0 0 0 62" fill="none" stroke="#74beff" stroke-opacity="0.055" stroke-width="1"/>
      </pattern>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#000814" flood-opacity="0.62"/>
      </filter>
      <clipPath id="screen"><rect x="750" y="185" width="1050" height="710" rx="30"/></clipPath>
    </defs>`
}

async function logoData() {
  return `data:image/png;base64,${(await fs.readFile(logoPath)).toString('base64')}`
}

async function renderIntro(scene, logo) {
  const outro = scene.kind === 'outro'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      ${baseDefs()}
      <rect width="1920" height="1080" fill="url(#bg)"/>
      <rect width="1920" height="1080" fill="url(#grid)"/>
      <circle cx="1560" cy="240" r="520" fill="url(#glow)"/>
      <circle cx="230" cy="1040" r="470" fill="#0d263f" opacity="0.72"/>
      <path d="M1390 80 Q1740 230 1790 620" fill="none" stroke="#9be11d" stroke-opacity="0.22" stroke-width="9"/>
      <path d="M1510 70 Q1780 270 1830 610" fill="none" stroke="#74beff" stroke-opacity="0.10" stroke-width="4"/>
      <image href="${logo}" x="${outro ? 580 : 540}" y="${outro ? 95 : 75}" width="${outro ? 760 : 840}" height="250" preserveAspectRatio="xMidYMid meet"/>
      <rect x="${outro ? 635 : 705}" y="360" width="${outro ? 650 : 510}" height="54" rx="27" fill="#9be11d" fill-opacity="0.13" stroke="#9be11d" stroke-opacity="0.7"/>
      <text x="960" y="396" text-anchor="middle" fill="#baf33e" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" letter-spacing="3">${escapeXml(scene.eyebrow)}</text>
      ${titleLines(scene.title, 960, 540, 92).replaceAll('x="960"', 'x="960" text-anchor="middle"')}
      <text x="960" y="${outro ? 790 : 785}" text-anchor="middle" fill="#c4d0de" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">${escapeXml(scene.body)}</text>
      ${outro ? '<rect x="685" y="845" width="550" height="92" rx="46" fill="#9be11d"/><text x="960" y="904" text-anchor="middle" fill="#06121e" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900">TENACEIQ.COM</text>' : '<text x="960" y="895" text-anchor="middle" fill="#74beff" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="800" letter-spacing="4">EXPLORE • IMPROVE • COMPETE • LEAD</text>'}
    </svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, `${scene.id}.png`))
}

async function renderProduct(scene, logo) {
  const capturePath = path.join(captureDir, scene.capture)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      ${baseDefs()}
      <rect width="1920" height="1080" fill="url(#bg)"/>
      <rect width="1920" height="1080" fill="url(#grid)"/>
      <circle cx="1730" cy="160" r="440" fill="url(#glow)"/>
      <image href="${logo}" x="110" y="60" width="360" height="108" preserveAspectRatio="xMinYMid meet"/>
      <rect x="110" y="250" width="${Math.min(590, 250 + scene.eyebrow.length * 10)}" height="48" rx="24" fill="#9be11d" fill-opacity="0.13" stroke="#9be11d" stroke-opacity="0.62"/>
      <text x="136" y="282" fill="#baf33e" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800" letter-spacing="2.3">${escapeXml(scene.eyebrow)}</text>
      ${titleLines(scene.title, 110, 405, 68)}
      <line x1="110" y1="${scene.title.length > 1 ? 590 : 505}" x2="610" y2="${scene.title.length > 1 ? 590 : 505}" stroke="#9be11d" stroke-width="5" stroke-linecap="round"/>
      <text x="110" y="${scene.title.length > 1 ? 665 : 580}" fill="#bdcada" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="600">${escapeXml(scene.body)}</text>
      <text x="110" y="930" fill="#74beff" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800" letter-spacing="2">TENACEIQ.COM</text>
      <rect x="720" y="155" width="1110" height="770" rx="38" fill="#020913" opacity="0.8" filter="url(#shadow)"/>
      <rect x="738" y="173" width="1074" height="734" rx="32" fill="#10243e" stroke="#74beff" stroke-opacity="0.32" stroke-width="2"/>
      <circle cx="780" cy="205" r="8" fill="#ff6b6b"/><circle cx="806" cy="205" r="8" fill="#ffd166"/><circle cx="832" cy="205" r="8" fill="#9be11d"/>
    </svg>`
  const screenshot = await sharp(capturePath)
    .resize(1050, 710, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer()
  const border = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
      <rect x="750" y="185" width="1050" height="710" rx="30" fill="none" stroke="#9be11d" stroke-opacity="0.42" stroke-width="4"/>
    </svg>`)
  await sharp(Buffer.from(svg))
    .composite([
      { input: screenshot, top: 185, left: 750 },
      { input: border, top: 0, left: 0 },
    ])
    .png()
    .toFile(path.join(workDir, `${scene.id}.png`))
}

function writeWavHeader(buffer, sampleRate, channels, dataBytes) {
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * 2, 28)
  buffer.writeUInt16LE(channels * 2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
}

async function renderMusic() {
  const sampleRate = 48000
  const seconds = 95
  const frames = sampleRate * seconds
  const dataBytes = frames * 4
  const wav = Buffer.alloc(44 + dataBytes)
  writeWavHeader(wav, sampleRate, 2, dataBytes)
  const chords = [
    [130.81, 164.81, 196.00],
    [110.00, 130.81, 164.81],
    [87.31, 110.00, 130.81],
    [98.00, 123.47, 146.83],
  ]
  for (let i = 0; i < frames; i += 1) {
    const t = i / sampleRate
    const chord = chords[Math.floor(t / 4) % chords.length]
    const within = t % 4
    const swell = Math.min(1, within / 0.55) * Math.min(1, (4 - within) / 0.65)
    const pulse = Math.pow(Math.max(0, 1 - ((t * 2) % 1) * 3.4), 2)
    const pad = chord.reduce((sum, frequency, index) => sum + Math.sin(2 * Math.PI * frequency * t + index * 0.7), 0) / chord.length
    const shimmer = Math.sin(2 * Math.PI * chord[2] * 2 * t) * 0.16
    const bass = Math.sin(2 * Math.PI * (chord[0] / 2) * t) * (0.28 + pulse * 0.22)
    const sample = Math.max(-1, Math.min(1, (pad * 0.43 * swell) + shimmer + bass))
    const left = Math.round(sample * 5800)
    const right = Math.round((sample * 0.94 + Math.sin(2 * Math.PI * chord[1] * t) * 0.04) * 5800)
    wav.writeInt16LE(left, 44 + i * 4)
    wav.writeInt16LE(right, 46 + i * 4)
  }
  await fs.writeFile(path.join(root, 'audio', 'music-bed.wav'), wav)
}

await fs.mkdir(workDir, { recursive: true })
const logo = await logoData()
for (const scene of scenes) {
  if (scene.kind) await renderIntro(scene, logo)
  else await renderProduct(scene, logo)
}
await renderMusic()
await fs.writeFile(path.join(root, 'storyboard.json'), JSON.stringify(scenes, null, 2))
console.log(`Generated ${scenes.length} scene frames and original music bed in ${root}`)
