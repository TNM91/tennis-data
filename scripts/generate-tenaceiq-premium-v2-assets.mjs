import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const repo = process.cwd()
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14')
const captureDir = path.join(root, 'premium-captures-centered')
const workDir = path.join(root, 'premium-v4-final', 'frames')
const audioDir = path.join(root, 'premium-v4-final', 'audio')
const logoPath = path.join(repo, 'public', 'brand', 'web', 'header-logo-transparent.png')
const width = 2560
const height = 1440

const scenes = [
  { id: '01-intro', kind: 'intro', eyebrow: 'MEET TENACEIQ', title: ['Tennis decisions,', 'made clearer.'], body: 'One connected path from the next point to the whole season.' },
  { id: '02-paths', kind: 'paths', eyebrow: 'START FREE. GROW BY ROLE.', title: ['One platform.', 'Seven ways to grow.'], body: 'Start free, then add the role tools that make tennis easier.' },
  { id: '03-free', eyebrow: 'FREE', title: ['Find your tennis.'], body: 'Search players, teams, leagues, rankings, and tournaments.', from: 'Scattered searches', to: 'One connected tennis view', proof: ['Search', 'Public context', 'Data Assist'], captures: ['01-explore.png'] },
  { id: '04-player', eyebrow: 'PLAYER', title: ['Make your game', 'personal.'], body: 'Bring My Lab, matchup prep, Level Up, and tactics together.', from: 'Raw match history', to: 'One clear next move', proof: ['My Lab', 'Matchup prep', 'Level Up'], captures: ['02-player.png', '03-matchup.png'] },
  { id: '05-coach', eyebrow: 'COACH', title: ['Give every player', 'the next step.'], body: 'Plan, assign, review, and follow up between sessions.', from: 'Notes across tools', to: 'A connected player path', proof: ['Lesson plans', 'Player work', 'Progress review'], captures: ['04-coach.png'] },
  { id: '06-captain', eyebrow: 'CAPTAIN', title: ['Run match week', 'with less chaos.'], body: 'See readiness, compare lineups, scout, and send the plan.', from: 'Availability in group texts', to: 'One trusted match-week plan', proof: ['Availability', 'Lineups', 'Team plan'], captures: ['05-captain.png'] },
  { id: '07-league', eyebrow: 'LEAGUE', title: ['Move the season', 'without the cleanup.'], body: 'Keep schedules, scores, standings, and events connected.', from: 'Spreadsheet cleanup', to: 'A season everyone can follow', proof: ['Schedules', 'Scores', 'Standings'], captures: ['06-league.png'] },
  { id: '08-full-court', eyebrow: 'FULL-COURT', title: ['Support every', 'tennis role.'], body: 'Connect players, coaching, teams, leagues, and tournaments.', from: 'Roles split apart', to: 'Every role connected', proof: ['Player', 'Coach', 'Captain', 'Organizer'], captures: ['02-player.png', '04-coach.png', '06-league.png'] },
  { id: '09-club', kind: 'club', eyebrow: 'CLUB', title: ['One connected', 'club experience.'], body: 'Players, staff, programs, teams, leagues, and tournaments—together.', from: 'Programs in separate systems', to: 'One branded club experience' },
  { id: '10-data', eyebrow: 'DATA ASSIST', title: ['Better data.', 'Better tools.'], body: 'Trusted uploads keep results, rosters, and schedules current.', from: 'Stale tennis context', to: 'Trusted, current data', proof: ['Scorecards', 'Rosters', 'Schedules'], captures: ['07-data.png'] },
  { id: '11-outro', kind: 'outro', eyebrow: 'START FREE. ADD ONLY WHAT HELPS.', title: ['Make your next', 'decision clearer.'], body: 'More Tennis. Less Chaos.' },
]

const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const logoData = `data:image/png;base64,${(await fs.readFile(logoPath)).toString('base64')}`

function defs() {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050d18"/><stop offset=".5" stop-color="#091a2f"/><stop offset="1" stop-color="#06131f"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18304b" stop-opacity=".78"/><stop offset="1" stop-color="#0a1628" stop-opacity=".9"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#9bea20" stop-opacity=".22"/><stop offset="1" stop-color="#9bea20" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#74beff" stroke-opacity=".045"/></pattern>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#000611" flood-opacity=".7"/></filter>
  </defs>`
}

function base() {
  return `${defs()}<rect width="2560" height="1440" fill="url(#bg)"/><rect width="2560" height="1440" fill="url(#grid)"/><circle cx="2250" cy="100" r="720" fill="url(#glow)"/><circle cx="-80" cy="1510" r="600" fill="#0c2945" opacity=".65"/><path d="M2040 40Q2450 230 2510 770" fill="none" stroke="#9bea20" stroke-opacity=".18" stroke-width="10"/><path d="M2150 20Q2470 260 2535 750" fill="none" stroke="#74beff" stroke-opacity=".08" stroke-width="4"/>`
}

function titleLines(lines, x, y, size = 94, anchor = 'start') {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * (size + 14)}" text-anchor="${anchor}" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="800" letter-spacing="-2.5">${escapeXml(line)}</text>`).join('')
}

function wrappedLines(value, maxLength = 48) {
  const words = String(value).split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxLength && current) { lines.push(current); current = word } else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

function bodyLines(value, x, y, size = 31, maxLength = 48) {
  return wrappedLines(value, maxLength).map((line, index) => `<text x="${x}" y="${y + index * (size + 14)}" fill="#c7d4e2" font-family="Arial" font-size="${size}" font-weight="600">${escapeXml(line)}</text>`).join('')
}

function smallLogo(x = 105, y = 48, w = 480) {
  return `<image href="${logoData}" x="${x}" y="${y}" width="${w}" height="150" preserveAspectRatio="xMinYMid meet"/>`
}

function eyebrow(text, x, y, w = 560) {
  return `<rect x="${x}" y="${y}" width="${w}" height="62" rx="31" fill="#9bea20" fill-opacity=".10" stroke="#9bea20" stroke-opacity=".72" stroke-width="2"/><text x="${x + 30}" y="${y + 41}" fill="#c1f74a" font-family="Arial" font-size="24" font-weight="800" letter-spacing="3">${escapeXml(text)}</text>`
}

function proofChips(items, x, y, maxWidth = 770) {
  let cursor = x
  let row = y
  return items.map((item) => {
    const chipWidth = Math.min(maxWidth, 58 + item.length * 14)
    if (cursor + chipWidth > x + maxWidth) { cursor = x; row += 68 }
    const result = `<rect x="${cursor}" y="${row}" width="${chipWidth}" height="48" rx="24" fill="#74beff" fill-opacity=".09" stroke="#74beff" stroke-opacity=".4"/><text x="${cursor + 24}" y="${row + 32}" fill="#d6e8f9" font-family="Arial" font-size="22" font-weight="700">${escapeXml(item)}</text>`
    cursor += chipWidth + 14
    return result
  }).join('')
}

async function roundedCapture(file, targetWidth, targetHeight) {
  const sourcePath = path.join(captureDir, file)
  const resized = await sharp(sourcePath)
    .resize(targetWidth, targetHeight, {
      fit: 'contain',
      position: 'center',
      background: { r: 6, g: 19, b: 33, alpha: 1 },
    })
    .sharpen({ sigma: 0.65 })
    .png()
    .toBuffer()
  const mask = Buffer.from(`<svg width="${targetWidth}" height="${targetHeight}"><rect width="${targetWidth}" height="${targetHeight}" rx="28" fill="#fff"/></svg>`)
  return sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

function tierBall(cx, cy, r, color) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d2036" stroke="#fff"/><path d="M${cx - r * .82} ${cy}C${cx - r * .52} ${cy - r * .48} ${cx - r * .08} ${cy - r * .18} ${cx + r * .12} ${cy + r * .06}C${cx + r * .38} ${cy + r * .38} ${cx + r * .7} ${cy + r * .32} ${cx + r * .88} ${cy + r * .04}" fill="none" stroke="${color}"/>`
}

function tierIcon(kind, x, y, color, scale = .68) {
  const ball = (cx, cy, r) => tierBall(cx, cy, r, color)
  const bodies = {
    free: `${ball(24, 31, 10.5)}<path d="M7 65v-7a17 17 0 0 1 34 0v7M48 78h39M53 78V64M66 78V54M79 78V42"/><path d="M50 58l12-12 10 7 13-19" stroke="${color}"/><circle cx="50" cy="58" r="3.5" fill="#0d2036" stroke="${color}"/><circle cx="62" cy="46" r="3.5" fill="#0d2036" stroke="${color}"/><circle cx="72" cy="53" r="3.5" fill="#0d2036" stroke="${color}"/><circle cx="85" cy="34" r="3.5" fill="#0d2036" stroke="${color}"/>`,
    player: `<path d="M17 74h62v7H17zM24 36h48v38H24z"/>${ball(48, 29, 10.5)}<path d="M34 62l10-10 9 7 13-18" stroke="${color}"/><circle cx="44" cy="52" r="3" fill="#0d2036" stroke="${color}"/><circle cx="53" cy="59" r="3" fill="#0d2036" stroke="${color}"/><path d="M34 67h31M59 63v-9M67 63V44" stroke="#74beff"/>`,
    coach: `${ball(29, 28, 10.5)}<path d="M12 62v-7a17 17 0 0 1 34 0v7M48 72c18-2 19-16 8-19s-7-17 14-18" stroke-dasharray="4 7"/><circle cx="48" cy="72" r="4.5" fill="#0d2036"/><circle cx="70" cy="35" r="4.5" fill="#0d2036"/><path d="M72 18v27M72 18l17 7-17 7" stroke="${color}"/><path d="M52 52l10-8" stroke="#74beff"/>`,
    captain: `${ball(48, 21, 10.5)}<path d="M48 32v9M20 41h56M20 41v14M39 41v14M57 41v14M76 41v14"/><circle cx="20" cy="66" r="8.5"/><circle cx="39" cy="66" r="8.5" stroke="${color}"/><circle cx="57" cy="66" r="8.5"/><circle cx="76" cy="66" r="8.5" stroke="${color}"/><path d="M17 66h6M36 66h6M54 66h6M73 66h6" stroke="#74beff"/><path d="M32 79h32" stroke="${color}"/>`,
    league: `${ball(48, 24, 11)}<path d="M22 77V62h52v15M34 62V50h28v12M43 50V38h10v12M48 61v16"/><path d="M48 42v14M45 45l3-3 3 3" stroke="${color}"/>`,
    full: `${ball(48, 48, 11)}<circle cx="19" cy="22" r="8"/><circle cx="77" cy="22" r="8"/><circle cx="19" cy="76" r="8"/><circle cx="77" cy="76" r="8"/><path d="M27 28l13 13M69 28L56 41M27 70l13-13M69 70L56 57" stroke="${color}"/><path d="M19 14v-4M77 14v-4M19 84v4M77 84v4" stroke="#74beff"/>`,
    club: `<path d="M18 79V39L48 22l30 17v40M12 79h72M28 48h12M56 48h12M28 61h12M56 61h12M43 79V62h10v17"/><path d="M27 34h42M35 79V69M61 79V69" stroke="${color}"/>${ball(48, 21, 9)}<path d="M18 86h60" stroke="#74beff"/>`,
    clubNetwork: `<path d="M28 75V42l20-12 20 12v33M22 75h52M38 52h8M52 52h8M43 75V62h10v13"/>${ball(48, 28, 8)}<circle cx="14" cy="30" r="7"/><circle cx="82" cy="30" r="7"/><circle cx="14" cy="75" r="7"/><circle cx="82" cy="75" r="7"/><path d="M21 33l12 8M75 33l-12 8M21 72l12-7M75 72l-12-7" stroke="${color}"/><path d="M7 87h82" stroke="#74beff"/>`,
  }
  return `<g transform="translate(${x} ${y}) scale(${scale})" color="#ffffff" fill="none" stroke="currentColor" stroke-width="3.45" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="96" height="96" rx="22" fill="${color}" fill-opacity=".10" stroke="${color}" stroke-opacity=".6"/>${bodies[kind]}</g>`
}

function transformationCard(from, to, x, y, w = 770) {
  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="190" rx="30" fill="#081525" fill-opacity=".88" stroke="#74beff" stroke-opacity=".22" stroke-width="2"/>
    <text x="34" y="42" fill="#8fa3b8" font-family="Arial" font-size="18" font-weight="800" letter-spacing="2.8">BEFORE</text>
    <text x="34" y="78" fill="#c7d4e2" font-family="Arial" font-size="25" font-weight="700">${escapeXml(from)}</text>
    <path d="M34 103H${w - 34}" stroke="#74beff" stroke-opacity=".22" stroke-width="2"/>
    <circle cx="${w - 58}" cy="103" r="22" fill="#9bea20"/><path d="M${w - 67} 103H${w - 49}M${w - 56} 94l9 9-9 9" fill="none" stroke="#06131f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="34" y="140" fill="#c1f74a" font-family="Arial" font-size="18" font-weight="800" letter-spacing="2.8">WITH TENACEIQ</text>
    <text x="34" y="174" fill="#ffffff" font-family="Arial" font-size="27" font-weight="800">${escapeXml(to)}</text>
  </g>`
}

function frameBorder(x, y, w, h, color = '#9bea20') {
  return Buffer.from(`<svg width="2560" height="1440"><rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" rx="40" fill="none" stroke="${color}" stroke-opacity=".46" stroke-width="4"/></svg>`)
}

async function renderIntro(scene) {
  const outro = scene.kind === 'outro'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}
    <image href="${logoData}" x="690" y="95" width="1180" height="360" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${outro ? 740 : 830}" y="470" width="${outro ? 1080 : 900}" height="70" rx="35" fill="#9bea20" fill-opacity=".1" stroke="#9bea20" stroke-opacity=".72" stroke-width="2"/>
    <text x="1280" y="516" text-anchor="middle" fill="#c1f74a" font-family="Arial" font-size="26" font-weight="800" letter-spacing="3.5">${escapeXml(scene.eyebrow)}</text>
    ${titleLines(scene.title, 1280, 700, 112, 'middle')}
    <text x="1280" y="1065" text-anchor="middle" fill="#c7d4e2" font-family="Arial" font-size="40" font-weight="500">${escapeXml(scene.body)}</text>
    ${outro ? '<rect x="860" y="1140" width="840" height="112" rx="56" fill="#9bea20"/><text x="1280" y="1213" text-anchor="middle" fill="#06131f" font-family="Arial" font-size="44" font-weight="900">TENACEIQ.COM</text>' : '<text x="1280" y="1205" text-anchor="middle" fill="#74beff" font-family="Arial" font-size="26" font-weight="800" letter-spacing="5">PLAY • IMPROVE • LEAD • ORGANIZE</text>'}
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, `${scene.id}.png`))
}

// Kept as a reference layout for future cutdowns.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function renderPaths(scene) {
  const roles = [
    ['PLAYER', 'Your game, made personal', 1015, 330, '#74beff'],
    ['COACH', 'Keep development moving', 1515, 280, '#9bea20'],
    ['CAPTAIN', 'Lead the next match week', 2015, 330, '#74beff'],
    ['LEAGUE', 'Run the competition', 1015, 835, '#9bea20'],
    ['FULL-COURT', 'Connect every role', 1515, 885, '#74beff'],
    ['CLUB', 'Scale one experience', 2015, 835, '#9bea20'],
  ]
  const centerX = 1745
  const centerY = 675
  const connectors = roles.map(([, , x, y, color]) => `<path d="M${centerX} ${centerY} Q${(centerX + x + 190) / 2} ${(centerY + y + 72) / 2 - 35} ${x + 190} ${y + 72}" fill="none" stroke="${color}" stroke-opacity=".32" stroke-width="4" stroke-dasharray="9 12"/>`).join('')
  const roleCards = roles.map(([name, cue, x, y, color]) => `<g transform="translate(${x} ${y})"><rect width="380" height="145" rx="30" fill="#0a182b" fill-opacity=".96" stroke="${color}" stroke-opacity=".68" stroke-width="3" filter="url(#shadow)"/><circle cx="58" cy="52" r="28" fill="${color}" fill-opacity=".15" stroke="${color}" stroke-width="2"/><text x="58" y="62" text-anchor="middle" fill="#fff" font-family="Arial" font-size="27" font-weight="900">${name[0]}</text><text x="102" y="58" fill="#fff" font-family="Arial" font-size="25" font-weight="900" letter-spacing=".5">${name}</text><text x="34" y="111" fill="#b9cadb" font-family="Arial" font-size="21" font-weight="600">${cue}</text></g>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}${smallLogo(105, 38, 470)}${eyebrow(scene.eyebrow, 105, 250, 720)}${titleLines(scene.title, 105, 430, 82)}
    ${bodyLines('Start free. Add the role you need. Your tennis stays connected.', 105, 675, 31, 39)}
    <g transform="translate(105 825)"><rect width="705" height="180" rx="34" fill="#081525" stroke="#74beff" stroke-opacity=".28" stroke-width="2"/><text x="34" y="48" fill="#74beff" font-family="Arial" font-size="19" font-weight="800" letter-spacing="3">ONE TENNIS IDENTITY</text><text x="34" y="94" fill="#fff" font-family="Arial" font-size="30" font-weight="800">Every role builds on the last.</text><text x="34" y="140" fill="#c1f74a" font-family="Arial" font-size="23" font-weight="800">EXPLORE → IMPROVE → LEAD → ORGANIZE</text></g>
    <g><rect x="950" y="235" width="1490" height="915" rx="52" fill="#071526" fill-opacity=".72" stroke="#9bea20" stroke-opacity=".42" stroke-width="4"/><rect x="1010" y="280" width="1370" height="820" rx="32" fill="none" stroke="#74beff" stroke-opacity=".12" stroke-width="3"/><path d="M1695 280V1100M1010 690H2380M1010 515H2380M1010 865H2380" fill="none" stroke="#74beff" stroke-opacity=".09" stroke-width="3"/><circle cx="1695" cy="690" r="115" fill="none" stroke="#9bea20" stroke-opacity=".10" stroke-width="3"/>${connectors}<g transform="translate(1510 575)"><rect width="470" height="200" rx="42" fill="#10243a" stroke="#9bea20" stroke-width="4" filter="url(#shadow)"/><circle cx="74" cy="70" r="38" fill="#9bea20"/><path d="M60 70h28M78 56l14 14-14 14" fill="none" stroke="#06131f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><text x="132" y="67" fill="#c1f74a" font-family="Arial" font-size="20" font-weight="800" letter-spacing="3">START HERE</text><text x="132" y="112" fill="#fff" font-family="Arial" font-size="38" font-weight="900">FREE</text><text x="42" y="165" fill="#c7d4e2" font-family="Arial" font-size="23" font-weight="700">Explore the whole tennis world.</text></g>${roleCards}</g>
    <text x="105" y="1190" fill="#74beff" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3.2">ONE PLATFORM • CONNECTED DATA • ROLE-SPECIFIC TOOLS</text><text x="2420" y="128" text-anchor="end" fill="#74beff" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3">02 / 11</text></svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, `${scene.id}.png`))
}

async function renderPathsValue(scene) {
  const roles = [
    ['PLAYER', 'Understand your game', 'My Lab • Matchups • Level Up', 760, 590, '#74beff'],
    ['COACH', 'Develop every player', 'Lessons • Assignments • Progress', 1310, 590, '#9bea20'],
    ['CAPTAIN', 'Lead match week', 'Readiness • Lineups • Scouting', 1860, 590, '#74beff'],
    ['LEAGUE', 'Run competition', 'Schedules • Scores • Standings', 760, 855, '#9bea20'],
    ['FULL-COURT', 'Connect every role', 'Player • Coach • Captain • Organizer', 1310, 855, '#74beff'],
    ['CLUB', 'Scale one experience', 'Staff • Programs • Teams • Events', 1860, 855, '#9bea20'],
  ]
  const iconByRole = { PLAYER: 'player', COACH: 'coach', CAPTAIN: 'captain', LEAGUE: 'league', 'FULL-COURT': 'full', CLUB: 'clubNetwork' }
  const cards = roles.map(([name, value, features, x, y, color]) => `<g transform="translate(${x} ${y})">
    <rect width="500" height="225" rx="32" fill="#09172a" fill-opacity=".96" stroke="${color}" stroke-opacity=".62" stroke-width="3" filter="url(#shadow)"/>
    ${tierIcon(iconByRole[name], 24, 20, color)}
    <text x="108" y="62" fill="#fff" font-family="Arial" font-size="27" font-weight="900">${name}</text>
    <text x="34" y="128" fill="${color}" font-family="Arial" font-size="25" font-weight="800">${value}</text>
    <path d="M34 151H466" stroke="#74beff" stroke-opacity=".16" stroke-width="2"/>
    <text x="34" y="190" fill="#c4d2e1" font-family="Arial" font-size="20" font-weight="700">${features}</text>
  </g>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}${smallLogo(105, 38, 470)}${eyebrow('START FREE. GROW BY ROLE.', 105, 220, 700)}
    ${titleLines(['Start where you are.', 'Grow where tennis takes you.'], 105, 350, 76)}
    <text x="105" y="515" fill="#c7d4e2" font-family="Arial" font-size="30" font-weight="600">One tennis identity. Your tennis data stays connected.</text>
    <g transform="translate(105 590)"><rect width="560" height="490" rx="42" fill="#10243a" stroke="#9bea20" stroke-width="4" filter="url(#shadow)"/>${tierIcon('free', 455, 28, '#9bea20')}
      <rect x="34" y="34" width="210" height="48" rx="24" fill="#9bea20"/><text x="139" y="66" text-anchor="middle" fill="#06131f" font-family="Arial" font-size="20" font-weight="900" letter-spacing="2">START HERE</text>
      <text x="34" y="150" fill="#fff" font-family="Arial" font-size="54" font-weight="900">FREE</text>
      <text x="34" y="207" fill="#c1f74a" font-family="Arial" font-size="29" font-weight="800">See the whole tennis world.</text>
      <path d="M34 240H526" stroke="#74beff" stroke-opacity=".24" stroke-width="2"/>
      <text x="34" y="294" fill="#d4e0ec" font-family="Arial" font-size="23" font-weight="700">✓ Search players and teams</text>
      <text x="34" y="342" fill="#d4e0ec" font-family="Arial" font-size="23" font-weight="700">✓ Explore leagues and rankings</text>
      <text x="34" y="390" fill="#d4e0ec" font-family="Arial" font-size="23" font-weight="700">✓ Contribute trusted data</text>
      <rect x="34" y="425" width="492" height="42" rx="21" fill="#74beff" fill-opacity=".10" stroke="#74beff" stroke-opacity=".45"/><text x="280" y="453" text-anchor="middle" fill="#fff" font-family="Arial" font-size="18" font-weight="800" letter-spacing="1.6">USEFUL BEFORE YOU UPGRADE</text>
    </g>
    <g><path d="M680 835H720M703 820l17 15-17 15" fill="none" stroke="#9bea20" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M720 835V700M720 835V968" fill="none" stroke="#9bea20" stroke-opacity=".3" stroke-width="3" stroke-dasharray="8 10"/></g>
    <text x="760" y="552" fill="#74beff" font-family="Arial" font-size="20" font-weight="900" letter-spacing="3">CHOOSE YOUR NEXT OUTCOME</text>
    ${cards}
    <rect x="760" y="1115" width="1600" height="72" rx="36" fill="#9bea20" fill-opacity=".09" stroke="#9bea20" stroke-opacity=".45"/><text x="1560" y="1161" text-anchor="middle" fill="#fff" font-family="Arial" font-size="25" font-weight="800" letter-spacing="2">YOUR PROFILE • YOUR TENNIS DATA • CONNECTED AT EVERY LEVEL</text>
    <text x="2420" y="128" text-anchor="end" fill="#74beff" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3">02 / 11</text></svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, `${scene.id}.png`))
}

async function renderProduct(scene, index) {
  const bodyY = scene.title.length > 1 ? 755 : 645
  const transformationY = bodyY + wrappedLines(scene.body, 46).length * 52 + 34
  const proofY = transformationY + 222
  const capturePanelMarkup = scene.captures.length === 2
    ? `<rect x="925" y="235" width="1530" height="650" rx="44" fill="#071526" fill-opacity=".68" stroke="#74beff" stroke-opacity=".18" stroke-width="3"/><text x="950" y="295" fill="#74beff" font-family="Arial" font-size="21" font-weight="900" letter-spacing="2.5">PLAYER OVERVIEW</text><text x="1720" y="295" fill="#9bea20" font-family="Arial" font-size="21" font-weight="900" letter-spacing="2.5">MATCHUP INSIGHT</text><rect x="950" y="805" width="1480" height="56" rx="28" fill="#9bea20" fill-opacity=".08" stroke="#9bea20" stroke-opacity=".28"/><text x="1690" y="842" text-anchor="middle" fill="#d8e5f1" font-family="Arial" font-size="22" font-weight="800">THE COMPLETE PAGE STAYS VISIBLE • ONE PLAYER PATH, CONNECTED</text>`
    : scene.captures.length === 3
      ? `<rect x="925" y="235" width="1530" height="610" rx="44" fill="#071526" fill-opacity=".68" stroke="#74beff" stroke-opacity=".18" stroke-width="3"/><text x="1180" y="315" text-anchor="middle" fill="#74beff" font-family="Arial" font-size="21" font-weight="900" letter-spacing="2.5">PLAYER</text><text x="1680" y="315" text-anchor="middle" fill="#9bea20" font-family="Arial" font-size="21" font-weight="900" letter-spacing="2.5">COACH</text><text x="2180" y="315" text-anchor="middle" fill="#74beff" font-family="Arial" font-size="21" font-weight="900" letter-spacing="2.5">LEAGUE</text><path d="M1418 495H1440M1918 495H1940" stroke="#9bea20" stroke-width="5" stroke-linecap="round"/><rect x="950" y="710" width="1480" height="96" rx="34" fill="#9bea20" fill-opacity=".08" stroke="#9bea20" stroke-opacity=".3"/><text x="1690" y="751" text-anchor="middle" fill="#fff" font-family="Arial" font-size="25" font-weight="900">ONE TENNIS IDENTITY. EVERY ROLE CONNECTED.</text><text x="1690" y="783" text-anchor="middle" fill="#b9cadb" font-family="Arial" font-size="19" font-weight="700">Complete product views • Shared data • Role-specific tools</text>`
      : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}${smallLogo()}${eyebrow(scene.eyebrow, 105, 250, 620)}${titleLines(scene.title, 105, 430, 86)}<line x1="105" y1="${scene.title.length > 1 ? 675 : 565}" x2="790" y2="${scene.title.length > 1 ? 675 : 565}" stroke="#9bea20" stroke-width="6" stroke-linecap="round"/>${bodyLines(scene.body, 105, bodyY, 31, 46)}${transformationCard(scene.from, scene.to, 105, transformationY)}${proofChips(scene.proof, 105, proofY)}${capturePanelMarkup}<text x="105" y="1195" fill="#74beff" font-family="Arial" font-size="24" font-weight="800" letter-spacing="3">TENACEIQ.COM</text><text x="2420" y="128" text-anchor="end" fill="#74beff" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3">${String(index + 1).padStart(2, '0')} / 11</text></svg>`
  const composites = []
  if (scene.captures.length === 1) {
    const capture = await roundedCapture(scene.captures[0], 1440, 900)
    composites.push({ input: capture, left: 970, top: 205 }, { input: frameBorder(970, 205, 1440, 900), left: 0, top: 0 })
  } else if (scene.captures.length === 2) {
    const first = await roundedCapture(scene.captures[0], 710, 444)
    const second = await roundedCapture(scene.captures[1], 710, 444)
    composites.push({ input: first, left: 950, top: 320 }, { input: second, left: 1720, top: 320 }, { input: frameBorder(950, 320, 710, 444, '#74beff'), left: 0, top: 0 }, { input: frameBorder(1720, 320, 710, 444), left: 0, top: 0 })
  } else {
    for (let captureIndex = 0; captureIndex < 3; captureIndex += 1) {
      const left = 950 + captureIndex * 500
      const capture = await roundedCapture(scene.captures[captureIndex], 460, 288)
      composites.push({ input: capture, left, top: 350 }, { input: frameBorder(left, 350, 460, 288, captureIndex % 2 ? '#9bea20' : '#74beff'), left: 0, top: 0 })
    }
  }
  await sharp(Buffer.from(svg)).composite(composites).png().toFile(path.join(workDir, `${scene.id}.png`))
}

async function renderClub(scene) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}${smallLogo()}${eyebrow(scene.eyebrow, 105, 250, 520)}${titleLines(scene.title, 105, 430, 86)}${bodyLines(scene.body, 105, 720, 31, 45)}${transformationCard(scene.from, scene.to, 105, 875)}
    <g transform="translate(1040 210)"><rect width="1370" height="840" rx="44" fill="url(#glass)" stroke="#9bea20" stroke-opacity=".42" stroke-width="4" filter="url(#shadow)"/>
      <rect x="80" y="85" width="530" height="635" rx="34" fill="#071222" stroke="#74beff" stroke-opacity=".45" stroke-width="3"/><rect x="760" y="85" width="530" height="635" rx="34" fill="#071222" stroke="#9bea20" stroke-opacity=".52" stroke-width="3"/>
      ${tierIcon('club', 110, 115, '#74beff', 1.45)}${tierIcon('clubNetwork', 790, 115, '#9bea20', 1.45)}
      <text x="120" y="310" fill="#fff" font-family="Arial" font-size="42" font-weight="800">CLUB STARTER</text><text x="800" y="310" fill="#fff" font-family="Arial" font-size="42" font-weight="800">CLUB UNLIMITED</text>
      <text x="120" y="385" fill="#b7c9db" font-family="Arial" font-size="28">One location</text><text x="120" y="435" fill="#b7c9db" font-family="Arial" font-size="28">Up to 10 coaches or staff</text><text x="120" y="485" fill="#b7c9db" font-family="Arial" font-size="28">Up to 150 connected players</text>
      <text x="800" y="385" fill="#b7c9db" font-family="Arial" font-size="28">All locations</text><text x="800" y="435" fill="#b7c9db" font-family="Arial" font-size="28">Unlimited coaches and staff</text><text x="800" y="485" fill="#b7c9db" font-family="Arial" font-size="28">Unlimited connected players</text>
      <rect x="120" y="560" width="420" height="66" rx="33" fill="#74beff" fill-opacity=".1" stroke="#74beff"/><text x="330" y="604" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24" font-weight="800">ONE CONNECTED CLUB</text><rect x="800" y="560" width="420" height="66" rx="33" fill="#9bea20" fill-opacity=".12" stroke="#9bea20"/><text x="1010" y="604" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24" font-weight="800">CLUB-WIDE SCALE</text>
    </g><text x="105" y="1185" fill="#74beff" font-family="Arial" font-size="24" font-weight="800" letter-spacing="3">STAFF • PLAYERS • PROGRAMS • COMPETITION</text><text x="2420" y="128" text-anchor="end" fill="#74beff" font-family="Arial" font-size="22" font-weight="800" letter-spacing="3">09 / 11</text></svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, `${scene.id}.png`))
}

function writeWavHeader(buffer, sampleRate, channels, dataBytes) {
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * channels * 2, 28); buffer.writeUInt16LE(channels * 2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataBytes, 40)
}

async function renderMusic() {
  const sampleRate = 48000
  const seconds = 105
  const frames = sampleRate * seconds
  const wav = Buffer.alloc(44 + frames * 4)
  writeWavHeader(wav, sampleRate, 2, frames * 4)
  const chords = [[130.81, 164.81, 196], [110, 146.83, 174.61], [98, 123.47, 164.81], [116.54, 146.83, 196]]
  for (let i = 0; i < frames; i += 1) {
    const t = i / sampleRate
    const chord = chords[Math.floor(t / 4) % chords.length]
    const beat = (t * 2) % 1
    const pulse = Math.exp(-beat * 7)
    const bar = t % 4
    const swell = Math.min(1, bar / .7) * Math.min(1, (4 - bar) / .8)
    const pad = chord.reduce((sum, f, n) => sum + Math.sin(2 * Math.PI * f * t + n * .8), 0) / 3
    const pluckIndex = Math.floor(t * 2) % 3
    const pluck = Math.sin(2 * Math.PI * chord[pluckIndex] * 2 * t) * pulse
    const bass = Math.sin(2 * Math.PI * chord[0] / 2 * t)
    const kick = Math.sin(2 * Math.PI * (58 - beat * 24) * t) * Math.exp(-beat * 12)
    const sample = Math.max(-1, Math.min(1, pad * .32 * swell + pluck * .12 + bass * .16 + kick * .10))
    wav.writeInt16LE(Math.round(sample * 5700), 44 + i * 4)
    wav.writeInt16LE(Math.round((sample * .95 + Math.sin(2 * Math.PI * chord[1] * t) * .025) * 5700), 46 + i * 4)
  }
  await fs.writeFile(path.join(audioDir, 'premium-music-bed.wav'), wav)
}

await fs.mkdir(workDir, { recursive: true })
await fs.mkdir(audioDir, { recursive: true })
for (let index = 0; index < scenes.length; index += 1) {
  const scene = scenes[index]
  if (scene.kind === 'intro' || scene.kind === 'outro') await renderIntro(scene)
  else if (scene.kind === 'paths') await renderPathsValue(scene)
  else if (scene.kind === 'club') await renderClub(scene)
  else await renderProduct(scene, index)
}
await renderMusic()
await fs.writeFile(path.join(root, 'premium-v4-final', 'storyboard.json'), JSON.stringify(scenes, null, 2))
console.log(`Generated ${scenes.length} final-master frames at ${width}x${height}.`)
