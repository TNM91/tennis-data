import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const repo = process.cwd()
const root = path.join(repo, 'artifacts', 'tenaceiq-intro-2026-08-14')
const output = path.join(root, 'tier-deep-dives')
const frames = path.join(output, 'frames')
const logoPath = path.join(repo, 'public', 'brand', 'web', 'header-logo-transparent.png')
const logoData = `data:image/png;base64,${(await fs.readFile(logoPath)).toString('base64')}`

const tiers = [
  { id: 'free', name: 'FREE', icon: 'free', color: '#9bea20', title: 'See the whole tennis world.', cue: 'Useful context before you upgrade.', features: ['Search players and teams', 'Explore leagues and rankings', 'Contribute trusted data'], action: 'START FREE', page: '03-free.png' },
  { id: 'player', name: 'PLAYER', icon: 'player', color: '#74beff', title: 'Make your game personal.', cue: 'Turn match history into a clearer next move.', features: ['My Lab', 'Matchup prep', 'Level Up and tactics'], action: 'UNLOCK PLAYER', page: '04-player.png' },
  { id: 'coach', name: 'COACH', icon: 'coach', color: '#9bea20', title: 'Develop every player.', cue: 'Keep the next step moving between lessons.', features: ['Lesson planning', 'Player assignments', 'Progress review'], action: 'OPEN COACH HUB', page: '05-coach.png' },
  { id: 'captain', name: 'CAPTAIN', icon: 'captain', color: '#74beff', title: 'Lead match week.', cue: 'Move from scattered answers to one trusted plan.', features: ['Readiness', 'Lineup scenarios', 'Scouting and team plan'], action: 'OPEN TEAM HUB', page: '06-captain.png' },
  { id: 'league', name: 'LEAGUE', icon: 'league', color: '#9bea20', title: 'Run the competition.', cue: 'Keep the season moving without spreadsheet cleanup.', features: ['Schedules', 'Scores and standings', 'League and event tools'], action: 'OPEN LEAGUE OFFICE', page: '07-league.png' },
  { id: 'full-court', name: 'FULL-COURT', icon: 'full', color: '#74beff', title: 'Connect every role.', cue: 'One identity across the tennis jobs you handle.', features: ['Player and Coach', 'Captain and League', 'Tournament Desk'], action: 'UNLOCK FULL-COURT', page: '08-full-court.png' },
  { id: 'club', name: 'CLUB', icon: 'clubNetwork', color: '#9bea20', title: 'Scale one club experience.', cue: 'Connect staff, players, programs, and competition.', features: ['Club-branded experience', 'Staff and player connections', 'Programs, teams, and events'], action: 'EXPLORE CLUB', page: '09-club.png' },
]

function defs() {
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050d18"/><stop offset=".52" stop-color="#091a2f"/><stop offset="1" stop-color="#06131f"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#9bea20" stop-opacity=".22"/><stop offset="1" stop-color="#9bea20" stop-opacity="0"/></radialGradient><pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#74beff" stroke-opacity=".045"/></pattern><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000611" flood-opacity=".72"/></filter></defs>`
}

function base() {
  return `${defs()}<rect width="2560" height="1440" fill="url(#bg)"/><rect width="2560" height="1440" fill="url(#grid)"/><circle cx="2240" cy="90" r="720" fill="url(#glow)"/><circle cx="-80" cy="1500" r="600" fill="#0c2945" opacity=".65"/><path d="M2040 40Q2450 230 2510 770" fill="none" stroke="#9bea20" stroke-opacity=".18" stroke-width="10"/>`
}

function ball(cx, cy, r, color) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d2036" stroke="#fff"/><path d="M${cx - r * .82} ${cy}C${cx - r * .52} ${cy - r * .48} ${cx - r * .08} ${cy - r * .18} ${cx + r * .12} ${cy + r * .06}C${cx + r * .38} ${cy + r * .38} ${cx + r * .7} ${cy + r * .32} ${cx + r * .88} ${cy + r * .04}" fill="none" stroke="${color}"/>`
}

function iconBody(kind, color) {
  const b = (cx, cy, r) => ball(cx, cy, r, color)
  return {
    free: `${b(24,31,10.5)}<path d="M7 65v-7a17 17 0 0 1 34 0v7M48 78h39M53 78V64M66 78V54M79 78V42"/><path d="M50 58l12-12 10 7 13-19" stroke="${color}"/>`,
    player: `<path d="M17 74h62v7H17zM24 36h48v38H24z"/>${b(48,29,10.5)}<path d="M34 62l10-10 9 7 13-18" stroke="${color}"/><path d="M34 67h31M59 63v-9M67 63V44" stroke="#74beff"/>`,
    coach: `${b(29,28,10.5)}<path d="M12 62v-7a17 17 0 0 1 34 0v7M48 72c18-2 19-16 8-19s-7-17 14-18" stroke-dasharray="4 7"/><circle cx="48" cy="72" r="4.5"/><circle cx="70" cy="35" r="4.5"/><path d="M72 18v27M72 18l17 7-17 7" stroke="${color}"/>`,
    captain: `${b(48,21,10.5)}<path d="M48 32v9M20 41h56M20 41v14M39 41v14M57 41v14M76 41v14"/><circle cx="20" cy="66" r="8.5"/><circle cx="39" cy="66" r="8.5" stroke="${color}"/><circle cx="57" cy="66" r="8.5"/><circle cx="76" cy="66" r="8.5" stroke="${color}"/><path d="M32 79h32" stroke="${color}"/>`,
    league: `${b(48,24,11)}<path d="M22 77V62h52v15M34 62V50h28v12M43 50V38h10v12M48 61v16"/><path d="M48 42v14M45 45l3-3 3 3" stroke="${color}"/>`,
    full: `${b(48,48,11)}<circle cx="19" cy="22" r="8"/><circle cx="77" cy="22" r="8"/><circle cx="19" cy="76" r="8"/><circle cx="77" cy="76" r="8"/><path d="M27 28l13 13M69 28L56 41M27 70l13-13M69 70L56 57" stroke="${color}"/>`,
    clubNetwork: `<path d="M28 75V42l20-12 20 12v33M22 75h52M38 52h8M52 52h8M43 75V62h10v13"/>${b(48,28,8)}<circle cx="14" cy="30" r="7"/><circle cx="82" cy="30" r="7"/><circle cx="14" cy="75" r="7"/><circle cx="82" cy="75" r="7"/><path d="M21 33l12 8M75 33l-12 8M21 72l12-7M75 72l-12-7" stroke="${color}"/><path d="M7 87h82" stroke="#74beff"/>`,
  }[kind]
}

function icon(kind, x, y, color, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" color="#fff" fill="none" stroke="currentColor" stroke-width="3.45" stroke-linecap="round" stroke-linejoin="round"><rect width="96" height="96" rx="22" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".7"/>${iconBody(kind, color)}</g>`
}

function logo() { return `<image href="${logoData}" x="105" y="38" width="470" height="150" preserveAspectRatio="xMinYMid meet"/>` }

function chip(text, x, y, color) {
  const width = Math.max(220, Math.min(390, 70 + text.length * 13))
  return `<rect x="${x}" y="${y}" width="${width}" height="54" rx="27" fill="${color}" fill-opacity=".09" stroke="${color}" stroke-opacity=".42"/><text x="${x + 28}" y="${y + 36}" fill="#e3edf7" font-family="Arial" font-size="22" font-weight="800">${text}</text>`
}

async function writeSvg(file, svg) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(frames, file))
}

async function renderTier(tier, index) {
  const opener = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}${logo()}<text x="2420" y="128" text-anchor="end" fill="#74beff" font-family="Arial" font-size="22" font-weight="900" letter-spacing="3">${String(index + 1).padStart(2,'0')} / 07</text><rect x="105" y="235" width="520" height="66" rx="33" fill="${tier.color}" fill-opacity=".1" stroke="${tier.color}" stroke-opacity=".7"/><text x="140" y="279" fill="${tier.color}" font-family="Arial" font-size="27" font-weight="900" letter-spacing="3">${tier.name} DEEP DIVE</text><text x="105" y="470" fill="#fff" font-family="Arial" font-size="104" font-weight="900" letter-spacing="-3">${tier.title}</text><text x="105" y="570" fill="#c7d4e2" font-family="Arial" font-size="38" font-weight="600">${tier.cue}</text><g transform="translate(105 700)">${tier.features.map((feature, featureIndex) => chip(feature, featureIndex * 420, 0, tier.color)).join('')}</g><g transform="translate(1660 260)"><rect width="680" height="680" rx="96" fill="#081525" stroke="${tier.color}" stroke-opacity=".55" stroke-width="5" filter="url(#shadow)"/>${icon(tier.icon, 110, 110, tier.color, 4.8)}<text x="340" y="610" text-anchor="middle" fill="${tier.color}" font-family="Arial" font-size="34" font-weight="900" letter-spacing="5">${tier.name}</text></g><text x="105" y="1220" fill="#74beff" font-family="Arial" font-size="25" font-weight="900" letter-spacing="4">QUICK VIEW • REAL PRODUCT • CLEAR NEXT STEP</text></svg>`

  const outcome = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">${base()}${logo()}<rect x="105" y="250" width="650" height="650" rx="70" fill="#081525" stroke="${tier.color}" stroke-opacity=".55" stroke-width="5" filter="url(#shadow)"/>${icon(tier.icon, 215, 355, tier.color, 4.5)}<text x="430" y="830" text-anchor="middle" fill="${tier.color}" font-family="Arial" font-size="34" font-weight="900" letter-spacing="4">${tier.name}</text><text x="920" y="360" fill="#74beff" font-family="Arial" font-size="25" font-weight="900" letter-spacing="4">WHAT IT HELPS YOU DO</text><text x="920" y="475" fill="#fff" font-family="Arial" font-size="76" font-weight="900">${tier.title}</text>${tier.features.map((feature, featureIndex) => `<g transform="translate(920 ${575 + featureIndex * 128})"><circle cx="30" cy="30" r="30" fill="${tier.color}"/><path d="M18 30l8 8 17-20" fill="none" stroke="#06131f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><text x="88" y="41" fill="#dce8f3" font-family="Arial" font-size="34" font-weight="800">${feature}</text></g>`).join('')}<rect x="920" y="1040" width="850" height="108" rx="54" fill="${tier.color}"/><text x="1345" y="1110" text-anchor="middle" fill="#06131f" font-family="Arial" font-size="36" font-weight="900">${tier.action}</text><text x="920" y="1225" fill="#c7d4e2" font-family="Arial" font-size="30" font-weight="700">TENACEIQ.COM • More Tennis. Less Chaos.</text></svg>`

  await writeSvg(`${tier.id}-01-opener.png`, opener)
  await writeSvg(`${tier.id}-03-outcome.png`, outcome)
}

await fs.mkdir(frames, { recursive: true })
await Promise.all(tiers.map(renderTier))
await fs.writeFile(path.join(output, 'tiers.json'), JSON.stringify(tiers, null, 2))
console.log(`Generated ${tiers.length * 2} tier deep-dive frames.`)
