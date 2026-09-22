import { chromium } from '@playwright/test'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const outputRoot = process.env.TENACEIQ_CLUB_COLLATERAL_OUTPUT
  ? path.resolve(process.env.TENACEIQ_CLUB_COLLATERAL_OUTPUT)
  : path.join(projectRoot, 'output', 'club-sales-collateral')
const onePagerDir = path.join(outputRoot, '01-one-pagers')
const deckDir = path.join(outputRoot, '02-sales-deck')
const viewsDir = path.join(outputRoot, '03-verified-product-views')
const guideDir = path.join(outputRoot, '04-sales-guide')
const tempDir = path.join(projectRoot, 'tmp', 'pdfs', 'club-sales-collateral')
const auditDir = path.join(projectRoot, 'artifacts', 'club-experience-audit')

await Promise.all([onePagerDir, deckDir, viewsDir, guideDir, tempDir].map((dir) => mkdir(dir, { recursive: true })))

const assets = {
  logo: await dataUri(path.join(projectRoot, 'public', 'brand', 'web', 'header-logo-transparent.png')),
  clubMark: await dataUri(path.join(projectRoot, 'public', 'brand', 'demo-clubs', 'northstar-tennis-club.png')),
  playerHome: await dataUri(path.join(auditDir, '13-player-id-connection.png')),
  myLab: await dataUri(path.join(auditDir, '05-player-mylab-handoff.png')),
  coach: await dataUri(path.join(auditDir, '12-coach-hub-handoff.png')),
  captain: await dataUri(path.join(auditDir, '08-captain-team-hub-handoff.png')),
  customization: await dataUri(path.join(auditDir, '09-club-customization.png')),
  leaguePolicy: await dataUri(path.join(auditDir, '10-league-result-policy.png')),
  tournament: await dataUri(path.join(auditDir, '11-tournament-result-policy.png')),
}

const starterUrl = 'https://www.tenaceiq.com/upgrade?plan=club_starter&next=%2Fclubs&utm_source=club_sales&utm_medium=pdf&utm_campaign=club_launch&utm_content=starter'
const unlimitedUrl = 'https://www.tenaceiq.com/upgrade?plan=club_unlimited&next=%2Fclubs&utm_source=club_sales&utm_medium=pdf&utm_campaign=club_launch&utm_content=unlimited'
assets.starterQr = await QRCode.toDataURL(starterUrl, { width: 260, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#071426', light: '#ffffff' } })
assets.unlimitedQr = await QRCode.toDataURL(unlimitedUrl, { width: 260, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#071426', light: '#ffffff' } })

const browser = await chromium.launch({ headless: true })
try {
  await renderPortrait(browser, 'TenAceIQ-Club-Sales-One-Pager', clubOnePager(assets))
  await renderPortrait(browser, 'TenAceIQ-Club-Pricing-Comparison', pricingOnePager(assets))
  await renderDeck(browser, salesDeck(assets))
} finally {
  await browser.close()
}

const viewMap = [
  ['01-club-member-home.png', '13-player-id-connection.png'],
  ['02-club-sponsored-my-lab.png', '05-player-mylab-handoff.png'],
  ['03-club-sponsored-coach-hub.png', '12-coach-hub-handoff.png'],
  ['04-club-sponsored-team-hub.png', '08-captain-team-hub-handoff.png'],
  ['05-club-customization.png', '09-club-customization.png'],
  ['06-league-result-policy.png', '10-league-result-policy.png'],
  ['07-tournament-desk.png', '11-tournament-result-policy.png'],
]
await Promise.all(viewMap.map(([target, source]) => copyFile(path.join(auditDir, source), path.join(viewsDir, target))))

await writeFile(path.join(guideDir, 'Club-Sales-Talk-Track.md'), talkTrack(), 'utf8')
await writeFile(path.join(outputRoot, 'README.md'), readme(), 'utf8')

console.log(JSON.stringify({ ok: true, outputRoot }, null, 2))

async function renderPortrait(browserInstance, stem, html) {
  const page = await browserInstance.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'screen' })
  const pdfPath = path.join(onePagerDir, `${stem}.pdf`)
  const pngPath = path.join(onePagerDir, `${stem}.png`)
  const jpgPath = path.join(onePagerDir, `${stem}.jpg`)
  await page.pdf({ path: pdfPath, width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  const png = await page.screenshot({ path: pngPath, fullPage: false })
  await sharp(png).jpeg({ quality: 94, mozjpeg: true }).toFile(jpgPath)
  await page.close()
}

async function renderDeck(browserInstance, slides) {
  const page = await browserInstance.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const rendered = []
  for (let index = 0; index < slides.length; index += 1) {
    const html = deckShell(slides[index])
    await page.setContent(html, { waitUntil: 'load' })
    const target = path.join(deckDir, `slide-${String(index + 1).padStart(2, '0')}.png`)
    await page.screenshot({ path: target, fullPage: false })
    rendered.push(html)
  }
  await page.setContent(deckDocument(rendered), { waitUntil: 'load' })
  await page.pdf({ path: path.join(deckDir, 'TenAceIQ-Club-Sales-Deck.pdf'), width: '13.333in', height: '7.5in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  await page.close()
}

function clubOnePager(a) {
  return portraitShell(`
    <main class="sheet club-sheet">
      <aside class="rail">
        <img class="brand" src="${a.logo}" alt="TenAceIQ">
        <p class="kicker">CLUB</p>
        <h1>CONNECT<br>THE CLUB.<em>KEEP EVERY<br>PLAYER MOVING.</em></h1>
        <p class="rail-copy"><b>Club</b> carries your identity, programs, coaching, teams, leagues, and tournaments into one connected tennis experience.</p>
        <div class="rail-rule"></div>
        <p class="price-label">CLUB STARTER</p>
        <div class="price"><strong>$99</strong><span>/ MONTH</span></div>
        <p class="limit">UP TO 10 COACHES OR STAFF<br>UP TO 150 CONNECTED PLAYERS</p>
        <p class="unlimited"><b>$149 / MONTH</b><br>UNLIMITED STAFF + PLAYERS</p>
        <a class="rail-cta" href="${starterUrl}">START CLUB</a>
        <p class="boundary">Works with your current registration, booking, and payment systems.</p>
        <div class="qr"><img src="${a.starterQr}" alt="QR code"><b>SCAN TO START</b><span>tenaceiq.com/upgrade?plan=club_starter</span></div>
      </aside>
      <section class="content">
        <h2>A PUBLIC PAGE SHOWS THE CLUB.<em>THE PAID VALUE CONNECTS EVERY EXPERIENCE.</em></h2>
        <p class="lead">Connect a member once. Their Club role, Player ID, programs, coaching, competition, and TenAceIQ tools stay together.</p>
        ${proofFrame(a.playerHome, 'VERIFIED PRODUCT VIEW · CLUB MEMBER HOME')}
        <div class="value-grid">
          ${valueBlock('01', 'CONNECT ONCE - WITHOUT DUPLICATES', 'Add a current TenAceIQ member or invite someone new. Match the Club membership to their existing Player ID so public history, My Lab, and TIQ ratings stay connected.')}
          ${valueBlock('02', 'TURN PROGRAMS INTO PLAYER PROGRESS', 'Club context follows the player into My Lab and the coach into Coach Hub - connecting assignments, goals, tactics, video, and the next useful step.')}
          ${valueBlock('03', 'RUN COMPETITION YOUR WAY', 'Choose TIQ rated, public history only, or social/event only when a league or tournament is created. The club decides what counts.')}
          ${valueBlock('04', 'MAKE IT FEEL LIKE YOUR CLUB', 'Use your logo, colors, public home, programs, schedules, people, communication, and competition setups - powered by TenAceIQ.')}
        </div>
        <div class="close"><b>WHY PAY FOR CLUB?</b><span>Because Club turns separate accounts and tools into one branded tennis relationship your members can actually use.</span></div>
      </section>
    </main>
  `)
}

function pricingOnePager(a) {
  return portraitShell(`
    <main class="pricing-sheet">
      <header class="pricing-header"><img src="${a.logo}" alt="TenAceIQ"><div><p>CLUB PRICING</p><h1>START CONNECTED.<br><em>REMOVE THE CAPS WHEN YOU GROW.</em></h1></div></header>
      <p class="pricing-lead">Both plans unlock the same premium Club experience. The difference is rollout size - not a stripped-down product.</p>
      <div class="plans">
        ${planCard({ name: 'CLUB STARTER', price: '$99', audience: 'For a focused rollout', accent: '#58dfff', qr: a.starterQr, url: starterUrl, rows: ['1 branded Club workspace', 'Up to 10 coaches or staff', 'Up to 150 connected players', 'Programs, clinics, teams, leagues, and tournaments', 'Club-sponsored Player, Coach, League, Tournament, and optional Captain experiences', 'TIQ rated, public-history-only, or social competition'] })}
        ${planCard({ name: 'CLUB UNLIMITED', price: '$149', audience: 'For a full club rollout', accent: '#9bea18', qr: a.unlimitedQr, url: unlimitedUrl, rows: ['Everything in Club Starter', 'Unlimited coaches and staff', 'Unlimited connected players', 'Unlimited clinics, camps, development groups, and teams', 'Reusable league and tournament setups', 'Club-wide onboarding and role-based home views'] })}
      </div>
      <section class="pricing-why"><h2>WHAT THE SUBSCRIPTION ACTUALLY BUYS</h2><div>${miniValue('ONE IDENTITY', 'Club membership and Player ID connect without creating duplicate player records.')}${miniValue('ONE DEVELOPMENT STORY', 'Programs, coaching, My Lab, goals, tactics, video, and progress stay connected.')}${miniValue('ONE COMPETITION SYSTEM', 'Schedules, entrants, scores, standings, public history, and rating policy stay intentional.')}</div></section>
      <footer class="pricing-footer"><strong>TenAceIQ Club complements your booking, registration, point-of-sale, and payment systems.</strong><span>Choose Starter for a controlled rollout. Choose Unlimited when caps would slow adoption.</span></footer>
    </main>
  `)
}

function salesDeck(a) {
  return [
    `<div class="cover"><img class="deck-logo" src="${a.logo}"><div class="cover-copy"><p>TenAceIQ Club</p><h1>CONNECT THE CLUB.<br><em>KEEP EVERY PLAYER MOVING.</em></h1><span>One branded tennis experience across members, programs, coaching, teams, leagues, and tournaments.</span></div><img class="cover-mark" src="${a.clubMark}"></div>`,
    `<div class="split"><div class="deck-copy"><p class="deck-kicker">THE WHY</p><h2>A PUBLIC PAGE IS THE FRONT DOOR.<br><em>CLUB IS THE CONNECTION BEHIND IT.</em></h2><p>Members should not have to rebuild their tennis identity every time they enter a program, work with a coach, join a team, or play an event.</p><strong class="statement">Connect once. Carry the club relationship everywhere.</strong></div>${deckProof(a.playerHome, 'Club member home · verified')}</div>`,
    `<div class="deck-title"><p class="deck-kicker">THE CONNECTION MODEL</p><h2>ONE MEMBERSHIP SETS THE ROLE.<br><em>PLAYER ID CONNECTS THE TENNIS HISTORY.</em></h2></div><div class="flow"><div><b>01</b><strong>JOIN THE CLUB</strong><span>Current TenAceIQ member or new invitation</span></div><i>→</i><div><b>02</b><strong>SET THE ROLE</strong><span>Player, coach, captain, coordinator, staff - or more than one</span></div><i>→</i><div><b>03</b><strong>CONNECT PLAYER ID</strong><span>No duplicate profile; public history and TIQ context stay intact</span></div><i>→</i><div><b>04</b><strong>OPEN THE RIGHT EXPERIENCE</strong><span>My Lab, Coach Hub, Team Hub, League Office, or Tournament Desk</span></div></div><p class="flow-note">Club is a connected operating layer across TenAceIQ - not a decorative portal and not a replacement for booking or payments.</p>`,
    `<div class="deck-title"><p class="deck-kicker">ROLE-BASED VALUE</p><h2>THE CLUB FOLLOWS EACH PERSON<br><em>INTO THE TOOLS THEY ACTUALLY USE.</em></h2></div><div class="role-proof">${roleProof(a.myLab, 'PLAYER', 'Club-sponsored My Lab keeps goals, programs, matches, and the next useful step connected.')}${roleProof(a.coach, 'COACH', 'Coach Hub carries the Club’s players, assignments, lesson notes, tactics, and progress.')}${roleProof(a.captain, 'CAPTAIN', 'Team Hub connects availability, projected lineups, messages, and match-week decisions.')}</div>`,
    `<div class="deck-title"><p class="deck-kicker">COMPETITION WITHOUT THE GUESSING</p><h2>THE CLUB DECIDES<br><em>HOW EVERY RESULT SHOULD COUNT.</em></h2></div><div class="competition-proof">${deckProof(a.leaguePolicy, 'League Office · result policy')}${deckProof(a.tournament, 'Tournament Desk · club-sponsored')}</div><div class="policy-row"><b>TIQ RATED</b><span>Public player history + TIQ rating update</span><b>PUBLIC HISTORY ONLY</b><span>Visible match history without rating impact</span><b>SOCIAL / EVENT ONLY</b><span>Local record; no public history or TIQ rating impact</span></div>`,
    `<div class="deck-title"><p class="deck-kicker">PRICING</p><h2>SAME PREMIUM CLUB EXPERIENCE.<br><em>CHOOSE THE ROLLOUT SIZE.</em></h2></div><div class="deck-plans"><div><p>CLUB STARTER</p><strong>$99<span>/MONTH</span></strong><ul><li>1 branded Club workspace</li><li>Up to 10 coaches or staff</li><li>Up to 150 connected players</li><li>Programs + competition + connected role experiences</li></ul></div><div class="recommended"><p>CLUB UNLIMITED</p><strong>$149<span>/MONTH</span></strong><ul><li>Everything in Starter</li><li>Unlimited coaches, staff, and connected players</li><li>Unlimited programs and teams</li><li>Club-wide onboarding and reusable competition setups</li></ul></div></div><div class="deck-close"><img src="${a.starterQr}"><div><b>START WITH THE ROLLOUT THAT FITS.</b><span>tenaceiq.com/upgrade?plan=club_starter</span></div></div>`,
  ]
}

function portraitShell(content) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${portraitCss()}</style></head><body>${content}</body></html>`
}

function deckShell(content) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${deckCss()}</style></head><body><main class="slide">${content}</main></body></html>`
}

function deckDocument(slideHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${deckCss()} @page{size:13.333in 7.5in;margin:0}html,body{width:auto;height:auto;overflow:visible}.slide{break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}</style></head><body>${slideHtml.map((html) => html.match(/<main class="slide">([\s\S]*)<\/main>/)?.[1] ?? '').map((body) => `<main class="slide">${body}</main>`).join('')}</body></html>`
}

function proofFrame(src, label) {
  return `<figure class="proof"><figcaption>${label}</figcaption><img src="${src}"></figure>`
}

function valueBlock(number, title, copy) {
  return `<article class="value"><b>${number}</b><div><h3>${title}</h3><p>${copy}</p></div></article>`
}

function planCard({ name, price, audience, accent, qr, url, rows }) {
  return `<article class="plan" style="--plan:${accent}"><p>${name}</p><h2>${price}<span>/MONTH</span></h2><strong>${audience}</strong><ul>${rows.map((row) => `<li>${row}</li>`).join('')}</ul><a href="${url}">CHOOSE ${name.replace('CLUB ', '')}</a><div class="plan-qr"><img src="${qr}"><span>SCAN TO START</span></div></article>`
}

function miniValue(title, copy) { return `<article><b>${title}</b><span>${copy}</span></article>` }
function deckProof(src, label) { return `<figure class="deck-proof"><img src="${src}"><figcaption>${label}</figcaption></figure>` }
function roleProof(src, role, copy) { return `<article><figure><img src="${src}"></figure><p>${role}</p><span>${copy}</span></article>` }

function portraitCss() {
  return `
  @page{size:Letter;margin:0}*{box-sizing:border-box}html,body{margin:0;width:8.5in;height:11in;overflow:hidden}body{font-family:"Segoe UI",Arial,sans-serif;color:#071426;background:#f7f8f5;-webkit-print-color-adjust:exact}.sheet{width:8.5in;height:11in;display:grid;grid-template-columns:2.72in 1fr;background:#f7f8f5}.rail{position:relative;overflow:hidden;padding:.3in .28in .25in;background:radial-gradient(circle at 80% 70%,#103b56 0,transparent 36%),#061326;color:white}.rail:after{content:"";position:absolute;left:-.4in;right:-.4in;bottom:-.74in;height:1.65in;transform:rotate(-9deg);background:linear-gradient(135deg,#66dfff,#9bea18)}.brand{width:2.1in;height:.58in;object-fit:contain;object-position:left center}.kicker,.price-label{margin:.25in 0 .1in;color:#9bea18;font-weight:950;letter-spacing:.2em;font-size:11px}.rail h1{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:43px;line-height:.91;letter-spacing:.005em}.rail h1 em{display:block;color:#60dfff;font-style:normal}.rail-copy{margin:.22in 0 0;font-size:15px;line-height:1.35;font-weight:750}.rail-copy b{color:#9bea18}.rail-rule{height:2px;margin:.18in 0;background:linear-gradient(90deg,#9bea18,#60dfff)}.price-label{margin:0 0 .02in;color:white}.price{display:flex;align-items:baseline;gap:8px}.price strong{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:52px;line-height:1}.price span{font-size:15px;font-weight:950}.limit{margin:.05in 0;font-size:11px;line-height:1.4;font-weight:900}.unlimited{margin:.1in 0 .14in;padding-top:.1in;border-top:1px solid rgba(255,255,255,.25);font-size:12px;line-height:1.4}.unlimited b{color:#60dfff}.rail-cta{display:block;padding:.11in;border-radius:7px;background:#9bea18;color:#071426;text-align:center;text-decoration:none;font:26px Impact,"Arial Narrow",sans-serif;letter-spacing:.05em}.boundary{margin:.12in 0 0;font-size:10px;line-height:1.35;font-weight:750;color:#d8e2ed}.qr{position:absolute;z-index:2;left:.28in;bottom:.16in;width:1.38in;text-align:center}.qr img{display:block;width:1.05in;height:1.05in;margin:auto;padding:5px;background:white;border:5px solid #071426;outline:3px solid #60dfff;border-radius:10px}.qr b{display:block;margin-top:6px;color:#071426;font-size:9px;letter-spacing:.08em}.qr span{display:block;color:#071426;font-size:6px}.content{padding:.27in .3in .22in}.content h2{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:31px;line-height:.94}.content h2 em{display:block;color:#4ecf72;font-style:normal}.lead{margin:.1in 0 .13in;padding-top:.1in;border-top:2px solid #4ecf72;font-size:14px;line-height:1.35;font-weight:750}.proof{position:relative;height:2.62in;margin:0 0 .14in;overflow:hidden;border:7px solid #071426;border-radius:14px;background:#071426;box-shadow:0 12px 25px rgba(7,20,38,.18)}.proof figcaption{position:absolute;z-index:2;right:10px;top:7px;color:white;font-size:8px;font-weight:950;letter-spacing:.13em}.proof img{width:100%;height:100%;object-fit:cover;object-position:top center}.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:.1in}.value{display:grid;grid-template-columns:.42in 1fr;gap:.08in;min-height:1.18in;padding:.1in;border-top:2px solid #4ecf72;background:#fff}.value>b{color:#4ecf72;font-family:Impact,"Arial Narrow",sans-serif;font-size:31px}.value h3{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:16px;line-height:1}.value p{margin:5px 0 0;color:#43536a;font-size:9px;line-height:1.35;font-weight:650}.close{display:grid;grid-template-columns:1.35in 1fr;gap:.12in;margin-top:.14in;padding:.12in;border:1px solid #4ecf72;background:#071426;color:white}.close b{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:17px}.close span{font-size:10px;line-height:1.35;font-weight:750}.pricing-sheet{width:8.5in;height:11in;padding:.3in;background:radial-gradient(circle at 95% 0,#dff7ff,transparent 32%),#f7f8f5}.pricing-header{display:flex;align-items:center;gap:.25in;padding:.18in .22in;background:#071426;color:white;border-radius:14px}.pricing-header img{width:2.1in}.pricing-header p{margin:0;color:#9bea18;font-size:10px;font-weight:950;letter-spacing:.2em}.pricing-header h1{margin:5px 0 0;font-family:Impact,"Arial Narrow",sans-serif;font-size:28px;line-height:.95}.pricing-header em{color:#60dfff;font-style:normal}.pricing-lead{margin:.18in auto;max-width:7.3in;text-align:center;font-size:16px;line-height:1.35;font-weight:800}.plans{display:grid;grid-template-columns:1fr 1fr;gap:.2in}.plan{position:relative;min-height:6.55in;padding:.22in;border:2px solid var(--plan);border-top:10px solid var(--plan);border-radius:14px;background:white;box-shadow:0 14px 30px rgba(7,20,38,.1)}.plan>p{margin:0;color:#36506a;font-size:12px;font-weight:950;letter-spacing:.16em}.plan h2{margin:.08in 0 0;color:var(--plan);font-family:Impact,"Arial Narrow",sans-serif;font-size:48px}.plan h2 span{margin-left:7px;color:#071426;font:900 14px "Segoe UI",Arial}.plan>strong{display:block;margin-bottom:.14in;font-size:15px}.plan ul{margin:0;padding:0;list-style:none}.plan li{position:relative;padding:.09in 0 .09in .22in;border-top:1px solid #dce3e9;font-size:11px;line-height:1.35;font-weight:720}.plan li:before{content:"✓";position:absolute;left:0;color:#398c2c;font-weight:950}.plan>a{position:absolute;left:.22in;right:1.28in;bottom:.22in;padding:.11in;border-radius:8px;background:var(--plan);color:#071426;text-align:center;text-decoration:none;font-family:Impact,"Arial Narrow",sans-serif;font-size:20px}.plan-qr{position:absolute;right:.2in;bottom:.15in;width:.85in;text-align:center}.plan-qr img{width:.78in;padding:4px;border:4px solid #071426;border-radius:8px;background:white}.plan-qr span{display:block;font-size:6px;font-weight:900}.pricing-why{margin-top:.2in;padding:.17in;background:#071426;color:white;border-radius:13px}.pricing-why h2{margin:0 0 .12in;color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:23px}.pricing-why>div{display:grid;grid-template-columns:repeat(3,1fr);gap:.12in}.pricing-why article{display:grid;gap:4px;padding-left:.1in;border-left:3px solid #60dfff}.pricing-why b{font-size:10px}.pricing-why span{color:#d6e0eb;font-size:8px;line-height:1.35}.pricing-footer{display:grid;grid-template-columns:1.2fr 1fr;gap:.18in;margin-top:.14in;padding:.12in;border-top:2px solid #4ecf72}.pricing-footer strong,.pricing-footer span{font-size:9px;line-height:1.4}
  .club-sheet .content h2{font-size:34px}.club-sheet .proof{height:2.72in;margin-bottom:.12in}.club-sheet .value-grid{grid-template-columns:1fr;gap:.07in}.club-sheet .value{grid-template-columns:.52in 1fr;align-items:start;gap:.1in;min-height:1.22in;padding:.11in .12in}.club-sheet .value>b{font-size:36px}.club-sheet .value h3{font-size:19px}.club-sheet .value p{font-size:10px;line-height:1.38}.club-sheet .close{margin-top:.1in}
  `
}

function deckCss() {
  return `
  @page{margin:0}*{box-sizing:border-box}html,body{margin:0;width:1600px;height:900px;overflow:hidden}body{font-family:"Segoe UI",Arial,sans-serif;color:white;background:#061326;-webkit-print-color-adjust:exact}.slide{position:relative;width:1600px;height:900px;overflow:hidden;padding:62px 72px;background:radial-gradient(circle at 95% 0,rgba(96,223,255,.16),transparent 32%),radial-gradient(circle at 0 100%,rgba(155,234,24,.12),transparent 30%),#061326}.slide:after{content:"";position:absolute;left:72px;right:72px;bottom:35px;height:3px;background:linear-gradient(90deg,#9bea18,#60dfff,transparent)}.cover{height:100%;display:grid;align-content:center}.deck-logo{position:absolute;left:72px;top:54px;width:360px}.cover-copy{max-width:1100px}.cover-copy>p,.deck-kicker{margin:0 0 18px;color:#9bea18;font-size:20px;font-weight:950;letter-spacing:.2em;text-transform:uppercase}.cover h1,.deck-title h2,.deck-copy h2{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:94px;line-height:.93;letter-spacing:.008em}.cover h1 em,.deck-title h2 em,.deck-copy h2 em{color:#60dfff;font-style:normal}.cover-copy>span{display:block;margin-top:32px;max-width:900px;color:#dbe5ef;font-size:28px;line-height:1.35;font-weight:720}.cover-mark{position:absolute;right:70px;bottom:70px;width:330px;height:330px;object-fit:contain;opacity:.28}.split{height:100%;display:grid;grid-template-columns:.92fr 1.08fr;gap:62px;align-items:center}.deck-copy h2,.deck-title h2{font-size:61px}.deck-copy>p:not(.deck-kicker){color:#d5dfeb;font-size:25px;line-height:1.45;font-weight:650}.statement{display:block;margin-top:35px;padding-left:20px;border-left:6px solid #9bea18;color:#9bea18;font-size:30px}.deck-proof{margin:0;overflow:hidden;border:7px solid #13263e;border-radius:24px;background:#071426;box-shadow:0 25px 70px rgba(0,0,0,.35)}.deck-proof img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}.deck-proof figcaption{padding:12px 18px;background:#12223a;color:#60dfff;font-size:15px;font-weight:900;letter-spacing:.09em}.split .deck-proof{height:640px}.deck-title{max-width:1320px}.flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:17px;align-items:stretch;margin-top:75px}.flow>div{display:grid;align-content:start;gap:13px;min-height:295px;padding:30px 26px;border-top:8px solid #60dfff;background:#0d2037}.flow>div:nth-of-type(2n){border-color:#9bea18}.flow b{color:#60dfff;font-family:Impact,"Arial Narrow",sans-serif;font-size:62px}.flow strong{font-size:23px}.flow span{color:#becbd9;font-size:17px;line-height:1.4;font-weight:650}.flow i{align-self:center;color:#9bea18;font-size:40px;font-style:normal}.flow-note{margin:35px 0 0;padding:18px 22px;border-left:6px solid #9bea18;background:#091a30;color:#dbe5ef;font-size:20px;font-weight:750}.role-proof{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:35px}.role-proof article{overflow:hidden;border-top:7px solid #60dfff;background:#0b1d34}.role-proof article:nth-child(2){border-color:#9bea18}.role-proof figure{height:320px;margin:0;overflow:hidden}.role-proof img{width:100%;height:100%;object-fit:cover;object-position:top}.role-proof p{margin:20px 24px 8px;color:#9bea18;font-size:18px;font-weight:950;letter-spacing:.16em}.role-proof span{display:block;margin:0 24px 25px;color:#d5dfeb;font-size:18px;line-height:1.4;font-weight:650}.competition-proof{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:32px}.competition-proof .deck-proof{height:350px}.policy-row{display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr;gap:14px;align-items:center;margin-top:28px;padding:22px;background:#0d2037}.policy-row b{color:#9bea18;font-size:15px}.policy-row span{color:#d5dfeb;font-size:14px;line-height:1.3}.deck-plans{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}.deck-plans>div{min-height:430px;padding:35px;border-top:10px solid #60dfff;background:#0d2037}.deck-plans .recommended{border-color:#9bea18}.deck-plans p{margin:0;color:#d5dfeb;font-size:19px;font-weight:950;letter-spacing:.15em}.deck-plans strong{display:block;margin-top:15px;color:#60dfff;font-family:Impact,"Arial Narrow",sans-serif;font-size:78px}.deck-plans .recommended strong{color:#9bea18}.deck-plans strong span{font:900 18px "Segoe UI",Arial}.deck-plans ul{margin:22px 0 0;padding-left:22px}.deck-plans li{margin:12px 0;color:#d5dfeb;font-size:18px;line-height:1.3}.deck-close{display:flex;align-items:center;gap:20px;position:absolute;right:72px;bottom:46px}.deck-close img{width:110px;padding:5px;background:white;border-radius:10px}.deck-close div{display:grid;gap:5px}.deck-close b{color:#9bea18;font-size:20px}.deck-close span{color:#d5dfeb;font-size:14px}
  `
}

function talkTrack() {
  return `# TenAceIQ Club sales talk track

## The 20-second answer

TenAceIQ Club connects the tennis experience around the systems a club already uses. It gives the club a branded home, connects each member to the right role and Player ID, and carries that context into My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk.

## Why would a club pay for this?

A public page can show programs. Club makes the member relationship usable. Add a current TenAceIQ member or invite someone new, set every role they have, and connect the membership to the member's existing Player ID. Their programs, coaching, My Lab, match history, and competition context remain connected without creating duplicate player data.

## What happens to match results?

The organizer chooses when creating the league or tournament:

- TIQ rated: results appear in public player history and update TIQ ratings.
- Public history only: results appear publicly but do not change TIQ ratings.
- Social / event only: the event stays local and does not affect public history or TIQ ratings.

## $99 versus $149

- Club Starter - $99/month: one branded Club workspace, up to 10 coaches or staff, and up to 150 connected players.
- Club Unlimited - $149/month: the same premium Club experience with unlimited coaches, staff, and connected players, plus unlimited programs and club-wide rollout support.

Starter is not a feature-reduced plan. It is a controlled rollout with capacity limits. Unlimited removes those limits.

## What TenAceIQ does not replace

TenAceIQ Club complements the club's booking, registration, point-of-sale, and payment systems. External registration links can send members back to the club's current system.

## Recommended close

Start with Club Starter if the club wants to prove the connected experience with a focused group. Choose Club Unlimited when the whole coaching staff and player base should participate from day one.
`
}

function readme() {
  return `# TenAceIQ Club sales collateral

This package uses verified TenAceIQ product views from the Northstar Tennis Club QA experience. Northstar is a fictional, generic demonstration club - not a subscriber or partner.

## Folder guide

- 01-one-pagers: print-ready PDFs plus PNG and JPG versions.
- 02-sales-deck: a six-page presentation PDF plus individual slide PNGs.
- 03-verified-product-views: clean source captures for proposals and follow-up emails.
- 04-sales-guide: pricing, data-flow, result-policy, and objection-handling talk track.

## Core message

Club is not simply a public portal. It is the connected operating layer that carries a club's identity and member context across Player, Coach, Captain, League, and Tournament experiences.

## Pricing

- Club Starter: $99/month; up to 10 coaches or staff and 150 connected players.
- Club Unlimited: $149/month; unlimited coaches, staff, and connected players.
`
}

async function dataUri(file) {
  const bytes = await readFile(file)
  const extension = path.extname(file).toLowerCase()
  const mime = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}
