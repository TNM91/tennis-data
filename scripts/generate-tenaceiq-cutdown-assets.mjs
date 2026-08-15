import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const repo = process.cwd()
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14')
const captureDir = path.join(root, 'captures')
const workDir = path.join(root, 'cutdown-work')
const horizontalDir = path.join(workDir, 'horizontal')
const verticalDir = path.join(workDir, 'vertical')
const logoPath = path.join(repo, 'public', 'brand', 'web', 'header-logo-transparent.png')

const scenes = [
  {
    id: '01-intro',
    kind: 'intro',
    eyebrow: 'MEET TENACEIQ',
    title: ['Tennis decisions,', 'made clearer.'],
    body: 'Find what matters. Know what comes next.',
  },
  {
    id: '02-explore',
    eyebrow: 'FREE + PERSONAL',
    title: ['Find your tennis.', 'Make it yours.'],
    body: 'Explore  •  My Lab  •  Player insight',
    captures: ['02-explore.png', '03-mylab.png'],
  },
  {
    id: '03-matchup',
    eyebrow: 'MATCHUP + PRACTICE',
    title: ['Prepare smarter.'],
    body: 'See the edge. Practice with purpose.',
    captures: ['04-matchup.png'],
  },
  {
    id: '04-team',
    eyebrow: 'COACH + CAPTAIN',
    title: ['Guide progress.', 'Run match week.'],
    body: 'Lessons  •  Lineups  •  Team decisions',
    captures: ['05-coaches.png', '06-captain.png'],
  },
  {
    id: '05-organize',
    eyebrow: 'LEAGUE + DATA',
    title: ['Move the season', 'with less admin.'],
    body: 'Schedules  •  Scores  •  Standings  •  Data',
    captures: ['07-leagues.png', '08-data-assist.png'],
  },
  {
    id: '07-montage',
    eyebrow: 'PLAY + LEAD + ORGANIZE',
    title: ['Your next match.', 'The whole season.'],
    body: 'Prepare  •  Lead  •  Organize',
    captures: ['04-matchup.png', '06-captain.png', '07-leagues.png'],
  },
  {
    id: '06-outro',
    kind: 'outro',
    eyebrow: 'START FREE',
    title: ['Make your next', 'decision clearer.'],
    body: 'More Tennis. Less Chaos.',
  },
]

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const dataUri = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`

function defs() {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#06111f"/>
        <stop offset="0.55" stop-color="#0a1b31"/>
        <stop offset="1" stop-color="#06121e"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#9be11d" stop-opacity="0.24"/><stop offset="1" stop-color="#9be11d" stop-opacity="0"/></radialGradient>
      <pattern id="grid" width="62" height="62" patternUnits="userSpaceOnUse"><path d="M62 0L0 0 0 62" fill="none" stroke="#74beff" stroke-opacity="0.055"/></pattern>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000814" flood-opacity="0.65"/></filter>
    </defs>`
}

function title(lines, x, y, size, anchor = 'start', gap = 12) {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * (size + gap)}" text-anchor="${anchor}" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="800" letter-spacing="-2">${escapeXml(line)}</text>`).join('')
}

async function screenshot(file, width, height) {
  return sharp(path.join(captureDir, file)).resize(width, height, { fit: 'cover', position: 'top' }).png().toBuffer()
}

async function renderHorizontal(scene, logo) {
  const centered = Boolean(scene.kind)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    ${defs()}<rect width="1920" height="1080" fill="url(#bg)"/><rect width="1920" height="1080" fill="url(#grid)"/>
    <circle cx="1650" cy="170" r="500" fill="url(#glow)"/><circle cx="140" cy="1080" r="430" fill="#0d263f" opacity=".7"/>
    ${centered ? `<path d="M1390 80Q1740 230 1790 620" fill="none" stroke="#9be11d" stroke-opacity=".22" stroke-width="9"/><image href="${logo}" x="560" y="82" width="800" height="235" preserveAspectRatio="xMidYMid meet"/><rect x="700" y="350" width="520" height="52" rx="26" fill="#9be11d" fill-opacity=".13" stroke="#9be11d" stroke-opacity=".7"/><text x="960" y="385" text-anchor="middle" fill="#baf33e" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3">${scene.eyebrow}</text>${title(scene.title, 960, 535, 88, 'middle')}
      <text x="960" y="790" text-anchor="middle" fill="#c4d0de" font-family="Arial" font-size="34">${scene.body}</text>${scene.kind === 'outro' ? '<rect x="690" y="845" width="540" height="92" rx="46" fill="#9be11d"/><text x="960" y="904" text-anchor="middle" fill="#06121e" font-family="Arial" font-size="34" font-weight="900">TENACEIQ.COM</text>' : '<text x="960" y="900" text-anchor="middle" fill="#74beff" font-family="Arial" font-size="23" font-weight="800" letter-spacing="4">EXPLORE • IMPROVE • COMPETE • LEAD</text>'}` : `
      <image href="${logo}" x="92" y="50" width="370" height="112" preserveAspectRatio="xMinYMid meet"/><rect x="92" y="225" width="480" height="50" rx="25" fill="#9be11d" fill-opacity=".13" stroke="#9be11d" stroke-opacity=".7"/><text x="120" y="258" fill="#baf33e" font-family="Arial" font-size="19" font-weight="800" letter-spacing="2.4">${scene.eyebrow}</text>${title(scene.title, 92, 380, 64)}<line x1="92" y1="${scene.title.length > 1 ? 555 : 470}" x2="585" y2="${scene.title.length > 1 ? 555 : 470}" stroke="#9be11d" stroke-width="5" stroke-linecap="round"/><text x="92" y="${scene.title.length > 1 ? 625 : 540}" fill="#bdcada" font-family="Arial" font-size="27" font-weight="600">${scene.body}</text><text x="92" y="930" fill="#74beff" font-family="Arial" font-size="21" font-weight="800" letter-spacing="2">TENACEIQ.COM</text>`}
  </svg>`
  const composites = []
  if (!centered) {
    if (scene.captures.length === 1) {
      composites.push({ input: await screenshot(scene.captures[0], 1080, 680), top: 198, left: 748 })
      composites.push({ input: Buffer.from('<svg width="1920" height="1080"><rect x="730" y="180" width="1116" height="716" rx="36" fill="none" stroke="#9be11d" stroke-opacity=".48" stroke-width="5"/></svg>'), top: 0, left: 0 })
    } else if (scene.captures.length === 2) {
      composites.push({ input: await screenshot(scene.captures[0], 1080, 318), top: 198, left: 748 })
      composites.push({ input: await screenshot(scene.captures[1], 1080, 318), top: 558, left: 748 })
      composites.push({ input: Buffer.from('<svg width="1920" height="1080"><rect x="730" y="180" width="1116" height="354" rx="34" fill="none" stroke="#74beff" stroke-opacity=".44" stroke-width="4"/><rect x="730" y="540" width="1116" height="354" rx="34" fill="none" stroke="#9be11d" stroke-opacity=".48" stroke-width="4"/></svg>'), top: 0, left: 0 })
    } else {
      composites.push({ input: await screenshot(scene.captures[0], 1080, 196), top: 198, left: 748 })
      composites.push({ input: await screenshot(scene.captures[1], 1080, 196), top: 430, left: 748 })
      composites.push({ input: await screenshot(scene.captures[2], 1080, 196), top: 662, left: 748 })
      composites.push({ input: Buffer.from('<svg width="1920" height="1080"><rect x="730" y="180" width="1116" height="232" rx="30" fill="none" stroke="#74beff" stroke-opacity=".45" stroke-width="4"/><rect x="730" y="412" width="1116" height="232" rx="30" fill="none" stroke="#9be11d" stroke-opacity=".5" stroke-width="4"/><rect x="730" y="644" width="1116" height="232" rx="30" fill="none" stroke="#74beff" stroke-opacity=".45" stroke-width="4"/></svg>'), top: 0, left: 0 })
    }
  }
  await sharp(Buffer.from(svg)).composite(composites).png().toFile(path.join(horizontalDir, `${scene.id}.png`))
}

async function renderVertical(scene, logo) {
  const centered = Boolean(scene.kind)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    ${defs()}<rect width="1080" height="1920" fill="url(#bg)"/><rect width="1080" height="1920" fill="url(#grid)"/>
    <circle cx="900" cy="220" r="500" fill="url(#glow)"/><circle cx="60" cy="1900" r="400" fill="#0d263f" opacity=".72"/>
    ${centered ? `<path d="M700 90Q1010 260 1030 720" fill="none" stroke="#9be11d" stroke-opacity=".22" stroke-width="8"/><image href="${logo}" x="95" y="180" width="890" height="300" preserveAspectRatio="xMidYMid meet"/><rect x="235" y="555" width="610" height="60" rx="30" fill="#9be11d" fill-opacity=".13" stroke="#9be11d"/><text x="540" y="595" text-anchor="middle" fill="#baf33e" font-family="Arial" font-size="25" font-weight="800" letter-spacing="3">${scene.eyebrow}</text>${title(scene.title, 540, 790, 78, 'middle', 18)}<text x="540" y="1120" text-anchor="middle" fill="#c4d0de" font-family="Arial" font-size="33">${scene.body}</text>${scene.kind === 'outro' ? '<rect x="180" y="1280" width="720" height="110" rx="55" fill="#9be11d"/><text x="540" y="1350" text-anchor="middle" fill="#06121e" font-family="Arial" font-size="40" font-weight="900">TENACEIQ.COM</text>' : '<text x="540" y="1290" text-anchor="middle" fill="#74beff" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3">EXPLORE • IMPROVE • COMPETE • LEAD</text>'}` : `
      <image href="${logo}" x="58" y="55" width="440" height="135" preserveAspectRatio="xMinYMid meet"/><rect x="58" y="240" width="600" height="54" rx="27" fill="#9be11d" fill-opacity=".13" stroke="#9be11d"/><text x="88" y="276" fill="#baf33e" font-family="Arial" font-size="21" font-weight="800" letter-spacing="2.5">${scene.eyebrow}</text>${title(scene.title, 58, 410, 65, 'start', 15)}<text x="58" y="${scene.title.length > 1 ? 620 : 535}" fill="#bdcada" font-family="Arial" font-size="29" font-weight="600">${scene.body}</text><text x="58" y="1535" fill="#74beff" font-family="Arial" font-size="23" font-weight="800" letter-spacing="2">TENACEIQ.COM</text>`}
  </svg>`
  const composites = []
  if (!centered) {
    if (scene.captures.length === 1) {
      composites.push({ input: await screenshot(scene.captures[0], 920, 690), top: 700, left: 80 })
      composites.push({ input: Buffer.from('<svg width="1080" height="1920"><rect x="62" y="682" width="956" height="726" rx="35" fill="none" stroke="#9be11d" stroke-opacity=".5" stroke-width="5"/></svg>'), top: 0, left: 0 })
    } else if (scene.captures.length === 2) {
      composites.push({ input: await screenshot(scene.captures[0], 920, 335), top: 690, left: 80 })
      composites.push({ input: await screenshot(scene.captures[1], 920, 335), top: 1060, left: 80 })
      composites.push({ input: Buffer.from('<svg width="1080" height="1920"><rect x="62" y="672" width="956" height="371" rx="32" fill="none" stroke="#74beff" stroke-opacity=".45" stroke-width="4"/><rect x="62" y="1042" width="956" height="371" rx="32" fill="none" stroke="#9be11d" stroke-opacity=".5" stroke-width="4"/></svg>'), top: 0, left: 0 })
    } else {
      composites.push({ input: await screenshot(scene.captures[0], 920, 210), top: 690, left: 80 })
      composites.push({ input: await screenshot(scene.captures[1], 920, 210), top: 940, left: 80 })
      composites.push({ input: await screenshot(scene.captures[2], 920, 210), top: 1190, left: 80 })
      composites.push({ input: Buffer.from('<svg width="1080" height="1920"><rect x="62" y="672" width="956" height="246" rx="30" fill="none" stroke="#74beff" stroke-opacity=".45" stroke-width="4"/><rect x="62" y="922" width="956" height="246" rx="30" fill="none" stroke="#9be11d" stroke-opacity=".5" stroke-width="4"/><rect x="62" y="1172" width="956" height="246" rx="30" fill="none" stroke="#74beff" stroke-opacity=".45" stroke-width="4"/></svg>'), top: 0, left: 0 })
    }
  }
  await sharp(Buffer.from(svg)).composite(composites).png().toFile(path.join(verticalDir, `${scene.id}.png`))
}

await fs.mkdir(horizontalDir, { recursive: true })
await fs.mkdir(verticalDir, { recursive: true })
const logo = await dataUri(logoPath)
for (const scene of scenes) {
  await renderHorizontal(scene, logo)
  await renderVertical(scene, logo)
}
await fs.writeFile(path.join(workDir, 'storyboard.json'), JSON.stringify(scenes, null, 2))
console.log(`Generated ${scenes.length} horizontal and vertical cutdown scenes.`)
