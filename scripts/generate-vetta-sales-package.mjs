import { chromium } from '@playwright/test'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const mainRoot = path.resolve(projectRoot, '..', '..')
const outputRoot = process.env.TENACEIQ_VETTA_PACKAGE_OUTPUT
  ? path.resolve(process.env.TENACEIQ_VETTA_PACKAGE_OUTPUT)
  : path.join(projectRoot, 'output', 'vetta-sales-package')
const sourceVettaDir = path.join(mainRoot, 'output', 'vetta-meeting', '05-vetta-brand-concept')
const auditDir = path.join(projectRoot, 'artifacts', 'club-experience-audit')
const onePagerDir = path.join(outputRoot, '01-one-pagers')
const deckDir = path.join(outputRoot, '02-executive-deck')
const proofDir = path.join(outputRoot, '03-verified-product-proof')
const guideDir = path.join(outputRoot, '04-meeting-guide')
const conceptDir = path.join(outputRoot, '05-vetta-brand-concept')

await Promise.all([onePagerDir, deckDir, proofDir, guideDir, conceptDir].map((dir) => mkdir(dir, { recursive: true })))

const assets = {
  tiq: await dataUri(path.join(projectRoot, 'public', 'brand', 'web', 'header-logo-transparent.png')),
  vetta: await dataUri(path.join(sourceVettaDir, 'vetta-logo-current.svg')),
  playerHome: await dataUri(path.join(auditDir, '13-player-id-connection.png')),
  myLab: await dataUri(path.join(auditDir, '05-player-mylab-handoff.png')),
  coach: await dataUri(path.join(auditDir, '12-coach-hub-handoff.png')),
  captain: await dataUri(path.join(auditDir, '08-captain-team-hub-handoff.png')),
  customization: await dataUri(path.join(auditDir, '09-club-customization.png')),
  leaguePolicy: await dataUri(path.join(auditDir, '10-league-result-policy.png')),
  tournament: await dataUri(path.join(auditDir, '11-tournament-result-policy.png')),
}

const starterUrl = 'https://www.tenaceiq.com/upgrade?plan=club_starter&next=%2Fclubs&utm_source=vetta_sales&utm_medium=pdf&utm_campaign=vetta_club&utm_content=starter'
const unlimitedUrl = 'https://www.tenaceiq.com/upgrade?plan=club_unlimited&next=%2Fclubs&utm_source=vetta_sales&utm_medium=pdf&utm_campaign=vetta_club&utm_content=unlimited'
assets.starterQr = await QRCode.toDataURL(starterUrl, qrOptions())
assets.unlimitedQr = await QRCode.toDataURL(unlimitedUrl, qrOptions())

const browser = await chromium.launch({ headless: true })
try {
  await renderPortrait(browser, 'TenAceIQ-Vetta-Club-Executive-Summary', executiveOnePager(assets), onePagerDir)
  await renderPortrait(browser, 'TenAceIQ-Vetta-Club-Pricing-and-Rollout', pricingOnePager(assets), onePagerDir)
  await renderPortrait(browser, 'TenAceIQ-Vetta-Club-Brand-Concept', brandConcept(assets), conceptDir)
  await renderDeck(browser, executiveDeck(assets))
} finally {
  await browser.close()
}

const proofMap = [
  ['01-club-member-and-player-id.png', '13-player-id-connection.png'],
  ['02-club-sponsored-my-lab.png', '05-player-mylab-handoff.png'],
  ['03-club-sponsored-coach-hub.png', '12-coach-hub-handoff.png'],
  ['04-club-sponsored-team-hub.png', '08-captain-team-hub-handoff.png'],
  ['05-club-customization.png', '09-club-customization.png'],
  ['06-league-result-policy.png', '10-league-result-policy.png'],
  ['07-tournament-result-policy.png', '11-tournament-result-policy.png'],
]
await Promise.all(proofMap.map(([target, source]) => copyFile(path.join(auditDir, source), path.join(proofDir, target))))
await copyFile(path.join(sourceVettaDir, 'vetta-logo-current.svg'), path.join(conceptDir, 'vetta-logo-current.svg'))
await Promise.all([
  writeFile(path.join(outputRoot, 'README.md'), readme(), 'utf8'),
  writeFile(path.join(guideDir, 'Vetta-Executive-Brief.md'), executiveBrief(), 'utf8'),
  writeFile(path.join(guideDir, 'Vetta-Meeting-Run-of-Show.md'), runOfShow(), 'utf8'),
  writeFile(path.join(guideDir, 'Vetta-Discovery-Questions.md'), discoveryQuestions(), 'utf8'),
  writeFile(path.join(guideDir, 'Sources-and-Claims.md'), sourcesAndClaims(), 'utf8'),
])

console.log(JSON.stringify({ ok: true, outputRoot }, null, 2))

async function renderPortrait(browserInstance, stem, html, directory) {
  const page = await browserInstance.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'screen' })
  const pdfPath = path.join(directory, `${stem}.pdf`)
  const pngPath = path.join(directory, `${stem}.png`)
  const jpgPath = path.join(directory, `${stem}.jpg`)
  await page.pdf({ path: pdfPath, width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  const png = await page.screenshot({ path: pngPath, fullPage: false })
  await sharp(png).jpeg({ quality: 94, mozjpeg: true }).toFile(jpgPath)
  await page.close()
}

async function renderDeck(browserInstance, slides) {
  const page = await browserInstance.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const renderedBodies = []
  for (let index = 0; index < slides.length; index += 1) {
    const html = deckShell(slides[index])
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: path.join(deckDir, `slide-${String(index + 1).padStart(2, '0')}.png`), fullPage: false })
    renderedBodies.push(slides[index])
  }
  await page.setContent(deckDocument(renderedBodies), { waitUntil: 'load' })
  await page.pdf({ path: path.join(deckDir, 'TenAceIQ-Vetta-Club-Executive-Conversation.pdf'), width: '13.333in', height: '7.5in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  await page.close()
}

function executiveOnePager(a) {
  return portraitShell(`
    <main class="sheet summary-sheet">
      <aside class="rail vetta-rail">
        <div class="co-brand"><img src="${a.vetta}" alt="Vetta Sports"><span>CLUB CONCEPT<br>POWERED BY</span><img src="${a.tiq}" alt="TenAceIQ"></div>
        <p class="kicker">VETTA RACQUET SPORTS</p>
        <h1>CONNECT<br>THE MEMBER.<em>KEEP THE<br>TENNIS MOVING.</em></h1>
        <p class="rail-copy">Vetta already offers the programs. TenAceIQ Club connects the identity, coaching, teams, leagues, and tournaments around them.</p>
        <div class="rail-rule"></div>
        <p class="price-label">RECOMMENDED DISCUSSION</p>
        <div class="price"><strong>$149</strong><span>/ MONTH</span></div>
        <p class="limit">CLUB UNLIMITED<br>ONE BRANDED WORKSPACE<br>NO STAFF OR PLAYER CAPS</p>
        <p class="starter-note"><b>$99 STARTER</b><br>Up to 10 coaches or staff<br>and 150 connected players.</p>
        <p class="boundary">Both plans use the same premium Club product. Pricing shown is for one branded Club workspace.</p>
        <div class="concept-tag">PROPOSAL CONCEPT - NOT A LIVE VETTA ACCOUNT</div>
      </aside>
      <section class="content">
        <h2>A PUBLIC PAGE CAN SHOW PROGRAMS.<em>CLUB CONNECTS WHAT HAPPENS NEXT.</em></h2>
        <p class="lead">A current TenAceIQ member keeps their identity. A new member is invited. Both connect to the right Vetta role and Player ID without duplicate tennis history.</p>
        ${proofFrame(a.playerHome, 'VERIFIED TENACEIQ PRODUCT VIEW - GENERIC QA CLUB')}
        <div class="value-grid">
          ${valueBlock('01', 'ONE MEMBER IDENTITY', 'Club membership links to the existing TenAceIQ Player ID so public match history, TIQ context, My Lab, and the Vetta relationship stay connected.')}
          ${valueBlock('02', 'ONE DEVELOPMENT STORY', 'Programs and coaching carry into My Lab and Coach Hub through goals, assignments, tactics, video, proof, and the next useful action.')}
          ${valueBlock('03', 'ONE COMPETITION POLICY', 'For each league or tournament, Vetta can choose TIQ rated, public history only, or social/event only.')}
          ${valueBlock('04', 'ONE BRANDED EXPERIENCE', 'Vetta logo, colors, programs, locations, people, teams, and competition live inside a Club experience powered by TenAceIQ.')}
        </div>
        <div class="close"><b>WHY WOULD VETTA PAY?</b><span>To turn separate member accounts and tennis tools into one visible relationship that players, coaches, captains, and organizers can act on.</span></div>
      </section>
    </main>
  `)
}

function pricingOnePager(a) {
  return portraitShell(`
    <main class="pricing-sheet">
      <header class="pricing-header"><div class="header-logos"><img src="${a.vetta}"><span>+</span><img src="${a.tiq}"></div><div><p>VETTA CLUB PRICING</p><h1>CHOOSE THE WORKSPACE.<br><em>THEN CHOOSE THE CAPACITY.</em></h1></div></header>
      <p class="pricing-lead">Each plan activates one branded Club workspace with the same connected Player, Coach, Captain, League, and Tournament experience.</p>
      <div class="plans">
        ${planCard({ name: 'CLUB STARTER', price: '$99', audience: 'Focused Vetta rollout', accent: '#58dfff', qr: a.starterQr, url: starterUrl, rows: ['1 branded Club workspace', 'Up to 10 coaches or staff', 'Up to 150 connected players', 'Programs, teams, leagues, and tournaments', 'TIQ rated, public-history-only, or social competition', 'Best when the first rollout stays under both caps'] })}
        ${planCard({ name: 'CLUB UNLIMITED', price: '$149', audience: 'Organization-scale capacity', accent: '#9bea18', qr: a.unlimitedQr, url: unlimitedUrl, rows: ['Everything in Club Starter', 'Unlimited coaches and staff', 'Unlimited connected players', 'Unlimited programs, groups, and teams', 'Reusable league and tournament setups', 'Best if one Vetta workspace exceeds either Starter cap'] })}
      </div>
      <section class="decision"><h2>THE COMMERCIAL DECISION COMES AFTER THE WORKSPACE DECISION</h2><div><b>ONE VETTA-WIDE WORKSPACE</b><span>One identity and operating layer across the racquet organization. Unlimited is the likely fit if adoption exceeds Starter capacity.</span><b>SEPARATE WORKSPACES</b><span>Distinct club homes by location. Scope the number of workspaces before quoting the rollout.</span></div></section>
      <footer class="pricing-footer"><strong>TenAceIQ complements Vetta's booking, registration, membership, point-of-sale, and payment systems.</strong><span>It connects the tennis experience around them.</span></footer>
    </main>
  `)
}

function brandConcept(a) {
  return portraitShell(`
    <main class="concept-sheet">
      <header class="concept-head"><img src="${a.vetta}"><div><p>MEMBER EXPERIENCE CONCEPT</p><h1>VETTA RACQUET SPORTS<em>POWERED BY TENACEIQ CLUB</em></h1></div><img src="${a.tiq}"></header>
      <section class="concept-hero"><div><p class="kicker">WHAT THE MEMBER FEELS</p><h2>ONE VETTA RELATIONSHIP.<br><em>EVERY TENNIS ROLE CONNECTED.</em></h2><p>Programs, coaches, teams, leagues, tournaments, Player ID, and the next useful action move together.</p></div>${proofFrame(a.playerHome, 'VERIFIED PRODUCT FOUNDATION - VETTA BRANDING SHOWN AS CONCEPT')}</section>
      <section class="concept-roles">${roleStrip('PLAYER', 'My Lab keeps goals, follows, tactics, video, match context, and progress together.', a.myLab)}${roleStrip('COACH', 'Coach Hub connects players, assignments, lesson notes, development plans, and proof.', a.coach)}${roleStrip('CAPTAIN + ORGANIZER', 'Team Hub, League Office, and Tournament Desk keep decisions and results visible.', a.captain)}</section>
      <section class="concept-close"><b>THIS IS REPRODUCIBLE WITH THE CURRENT CLUB PRODUCT.</b><span>Logo, color, public home, people, programs, roles, and competition policy are supported. Northstar is the verified generic QA club shown inside the product view; Vetta is a prospective customer, not part of the TenAceIQ model.</span></section>
    </main>
  `)
}

function executiveDeck(a) {
  return [
    `<div class="cover"><div class="cover-logos"><img src="${a.vetta}"><span>CLUB EXPERIENCE POWERED BY</span><img src="${a.tiq}"></div><div class="cover-copy"><p>AN EXECUTIVE CONVERSATION FOR VETTA RACQUET SPORTS</p><h1>CONNECT THE VETTA<br><em>TENNIS JOURNEY.</em></h1><span>Keep registration and payments in place. Connect the member identity, development story, teams, leagues, and tournaments around them.</span></div><div class="cover-band">PROPOSAL CONCEPT - VETTA IS A PROSPECTIVE CUSTOMER</div></div>`,
    `<div class="deck-title"><p class="deck-kicker">THE OPPORTUNITY</p><h2>VETTA ALREADY HAS THE PROGRAMS.<br><em>THE OPPORTUNITY IS CONTINUITY.</em></h2></div><div class="program-lines">${programLine('PLAY', 'Adult clinics, interclub and USTA teams, leagues, private lessons')}${programLine('DEVELOP', 'Junior clinics, team tennis, lessons, outdoor programs, summer camp')}${programLine('COMPETE', 'Teams, leagues, schedules, results, standings, and events')}</div><p class="source-line">Program examples: Vetta Sports official racquet-sports pages, accessed August 12, 2026.</p><div class="deck-statement">The question is not whether Vetta offers tennis. It is whether every member can see what happens next.</div>`,
    `<div class="deck-title"><p class="deck-kicker">THE CONNECTION MODEL</p><h2>ONE CLUB MEMBERSHIP SETS THE ROLE.<br><em>PLAYER ID CONNECTS THE TENNIS HISTORY.</em></h2></div><div class="flow">${flowStep('01','JOIN VETTA','Current TenAceIQ member or new invitation')}${flowArrow()}${flowStep('02','SET EVERY ROLE','Player, coach, captain, coordinator, staff')}${flowArrow()}${flowStep('03','CONNECT PLAYER ID','No duplicate profile; public history and TIQ context stay intact')}${flowArrow()}${flowStep('04','OPEN THE RIGHT TOOLS','My Lab, Coach Hub, Team Hub, League Office, Tournament Desk')}</div><p class="flow-note">Vetta keeps registration, membership, booking, point-of-sale, and payment. TenAceIQ connects the tennis experience.</p>`,
    `<div class="split"><div class="deck-copy"><p class="deck-kicker">WHY THE IDENTITY MATTERS</p><h2>THE MEMBER DOES NOT<br><em>START OVER AT THE CLUB DOOR.</em></h2><p>Club membership links to the member's existing Player ID. Their public history, TIQ context, My Lab, and Vetta relationship can stay connected without creating a duplicate tennis record.</p><strong class="statement">Connect once. Carry the context everywhere.</strong></div>${deckProof(a.playerHome, 'Verified Club member and Player ID experience')}</div>`,
    `<div class="deck-title"><p class="deck-kicker">ROLE-BASED VALUE</p><h2>THE CLUB FOLLOWS EACH PERSON<br><em>INTO THE WORK THEY ACTUALLY DO.</em></h2></div><div class="role-proof">${roleProof(a.myLab, 'PLAYER', 'My Lab keeps goals, programs, match context, tactics, video, and the next useful step connected.')}${roleProof(a.coach, 'COACH', 'Coach Hub carries players, assignments, lesson notes, plans, and visible progress.')}${roleProof(a.captain, 'CAPTAIN', 'Team Hub connects availability, projected lineups, messages, and match-week decisions.')}</div>`,
    `<div class="deck-title"><p class="deck-kicker">COMPETITION WITH INTENT</p><h2>VETTA DECIDES<br><em>HOW EACH RESULT SHOULD COUNT.</em></h2></div><div class="competition-proof">${deckProof(a.leaguePolicy, 'League Office - result policy')}${deckProof(a.tournament, 'Tournament Desk - result policy')}</div><div class="policy-row"><b>TIQ RATED</b><span>Public history + TIQ rating update</span><b>PUBLIC HISTORY ONLY</b><span>Visible history without rating impact</span><b>SOCIAL / EVENT ONLY</b><span>Local record; no public history or TIQ impact</span></div>`,
    `<div class="deck-title"><p class="deck-kicker">PRICING</p><h2>SAME PREMIUM CLUB PRODUCT.<br><em>CHOOSE THE CAPACITY.</em></h2></div><div class="deck-plans"><div><p>CLUB STARTER</p><strong>$99<span>/MONTH</span></strong><ul><li>1 branded Club workspace</li><li>Up to 10 coaches or staff</li><li>Up to 150 connected players</li><li>Best for a focused rollout under both caps</li></ul></div><div class="recommended"><p>CLUB UNLIMITED</p><strong>$149<span>/MONTH</span></strong><ul><li>The same complete Club experience</li><li>Unlimited coaches, staff, and connected players</li><li>Unlimited programs, groups, and teams</li><li>Likely fit for one Vetta-wide workspace</li></ul></div></div><p class="pricing-boundary">Pricing shown activates one branded Club workspace. If Vetta prefers separate workspaces by location, scope that structure before quoting.</p>`,
    `<div class="deck-title"><p class="deck-kicker">THE NEXT DECISION</p><h2>DEFINE THE SHAPE OF<br><em>THE VETTA CLUB EXPERIENCE.</em></h2></div><div class="decision-list">${decisionLine('01','WORKSPACE','One Vetta-wide racquet workspace or separate location workspaces?')}${decisionLine('02','FIRST JOURNEY','Player development, team operations, league, or tournament?')}${decisionLine('03','OWNER','Who will define roles, programs, and the first member group?')}${decisionLine('04','ACTIVATION','When will Vetta and TenAceIQ scope the live rollout together?')}</div><div class="deck-close"><b>RECOMMENDED NEXT STEP</b><span>A 45-minute workspace and rollout session with Vetta's racquet-sports owner.</span></div>`,
  ]
}

function portraitShell(content) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${portraitCss()}</style></head><body>${content}</body></html>`
}
function deckShell(content) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${deckCss()}</style></head><body><main class="slide">${content}</main></body></html>`
}
function deckDocument(bodies) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${deckCss()} @page{size:13.333in 7.5in;margin:0}html,body{width:auto;height:auto;overflow:visible}.slide{break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}</style></head><body>${bodies.map((body) => `<main class="slide">${body}</main>`).join('')}</body></html>`
}
function proofFrame(src, label) { return `<figure class="proof"><figcaption>${label}</figcaption><img src="${src}"></figure>` }
function valueBlock(number, title, copy) { return `<article class="value"><b>${number}</b><div><h3>${title}</h3><p>${copy}</p></div></article>` }
function planCard({ name, price, audience, accent, qr, url, rows }) { return `<article class="plan" style="--plan:${accent}"><p>${name}</p><h2>${price}<span>/MONTH</span></h2><strong>${audience}</strong><ul>${rows.map((row) => `<li>${row}</li>`).join('')}</ul><a href="${url}">CHOOSE ${name.replace('CLUB ', '')}</a><div class="plan-qr"><img src="${qr}"><span>SCAN TO START</span></div></article>` }
function roleStrip(role, copy, image) { return `<article><img src="${image}"><div><b>${role}</b><span>${copy}</span></div></article>` }
function deckProof(src, label) { return `<figure class="deck-proof"><img src="${src}"><figcaption>${label}</figcaption></figure>` }
function roleProof(src, role, copy) { return `<article><figure><img src="${src}"></figure><p>${role}</p><span>${copy}</span></article>` }
function programLine(label, copy) { return `<div><b>${label}</b><span>${copy}</span></div>` }
function flowStep(number, title, copy) { return `<div><b>${number}</b><strong>${title}</strong><span>${copy}</span></div>` }
function flowArrow() { return `<i>-&gt;</i>` }
function decisionLine(number, label, copy) { return `<div><b>${number}</b><strong>${label}</strong><span>${copy}</span></div>` }

function portraitCss() {
  return `
  @page{size:Letter;margin:0}*{box-sizing:border-box}html,body{margin:0;width:8.5in;height:11in;overflow:hidden}body{font-family:"Segoe UI",Arial,sans-serif;color:#071426;background:#f7f8f5;-webkit-print-color-adjust:exact}.sheet{width:8.5in;height:11in;display:grid;grid-template-columns:2.72in 1fr;background:#f7f8f5}.rail{position:relative;overflow:hidden;padding:.26in .25in .23in;background:radial-gradient(circle at 80% 72%,#17354c 0,transparent 36%),#061326;color:white}.vetta-rail:after{content:"";position:absolute;left:-.4in;right:-.4in;bottom:-.73in;height:1.62in;transform:rotate(-9deg);background:linear-gradient(135deg,#e31837 0 45%,#58dfff 45% 62%,#9bea18 62%)}.co-brand{display:grid;grid-template-columns:1fr;gap:4px;justify-items:start}.co-brand img:first-child{width:1.9in;height:.48in;object-fit:contain;object-position:left center;padding:5px;background:white;border-radius:5px}.co-brand img:last-child{width:1.65in;height:.36in;object-fit:contain;object-position:left center}.co-brand span{font-size:7px;line-height:1.2;font-weight:950;letter-spacing:.12em;color:#58dfff}.kicker,.price-label{margin:.18in 0 .08in;color:#9bea18;font-weight:950;letter-spacing:.18em;font-size:10px}.rail h1{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:39px;line-height:.91}.rail h1 em{display:block;color:#58dfff;font-style:normal}.rail-copy{margin:.18in 0 0;font-size:13px;line-height:1.37;font-weight:750}.rail-rule{height:2px;margin:.16in 0;background:linear-gradient(90deg,#e31837,#58dfff,#9bea18)}.price-label{margin:0 0 .02in;color:white}.price{display:flex;align-items:baseline;gap:7px}.price strong{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:48px;line-height:1}.price span{font-size:14px;font-weight:950}.limit{margin:.04in 0;font-size:10px;line-height:1.35;font-weight:900}.starter-note{margin:.1in 0;padding-top:.1in;border-top:1px solid rgba(255,255,255,.25);font-size:10px;line-height:1.35}.starter-note b{color:#58dfff}.boundary{margin:.1in 0 0;font-size:9px;line-height:1.35;font-weight:750;color:#d8e2ed}.concept-tag{position:absolute;z-index:2;left:.25in;right:.25in;bottom:.18in;color:#071426;font-size:7px;font-weight:950;letter-spacing:.08em}.content{padding:.25in .28in .2in}.content h2{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:29px;line-height:.94}.content h2 em{display:block;color:#4ecf72;font-style:normal}.lead{margin:.09in 0 .12in;padding-top:.09in;border-top:2px solid #e31837;font-size:12px;line-height:1.35;font-weight:750}.proof{position:relative;height:2.62in;margin:0 0 .11in;overflow:hidden;border:7px solid #071426;border-radius:14px;background:#071426;box-shadow:0 12px 25px rgba(7,20,38,.18)}.proof figcaption{position:absolute;z-index:2;right:10px;top:7px;color:white;font-size:7px;font-weight:950;letter-spacing:.1em}.proof img{width:100%;height:100%;object-fit:cover;object-position:top center}.value-grid{display:grid;grid-template-columns:1fr;gap:.07in}.value{display:grid;grid-template-columns:.42in 1fr;gap:.08in;min-height:1.11in;padding:.09in;border-top:2px solid #4ecf72;background:#fff}.value>b{color:#4ecf72;font-family:Impact,"Arial Narrow",sans-serif;font-size:29px}.value h3{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:15px;line-height:1}.value p{margin:4px 0 0;color:#43536a;font-size:8.5px;line-height:1.32;font-weight:650}.close{display:grid;grid-template-columns:1.4in 1fr;gap:.12in;margin-top:.1in;padding:.11in;border:1px solid #e31837;background:#071426;color:white}.close b{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:15px}.close span{font-size:9px;line-height:1.35;font-weight:750}.pricing-sheet{width:8.5in;height:11in;padding:.28in;background:radial-gradient(circle at 95% 0,#dff7ff,transparent 32%),#f7f8f5}.pricing-header{display:grid;grid-template-columns:2.65in 1fr;align-items:center;gap:.2in;padding:.17in .2in;background:#071426;color:white;border-radius:14px}.header-logos{display:flex;align-items:center;gap:9px}.header-logos img:first-child{width:1.25in;padding:5px;background:white;border-radius:5px}.header-logos img:last-child{width:1.1in}.header-logos span{color:#e31837;font-size:21px;font-weight:950}.pricing-header p{margin:0;color:#9bea18;font-size:9px;font-weight:950;letter-spacing:.18em}.pricing-header h1{margin:5px 0 0;font-family:Impact,"Arial Narrow",sans-serif;font-size:25px;line-height:.95}.pricing-header em{color:#58dfff;font-style:normal}.pricing-lead{margin:.16in auto;max-width:7.4in;text-align:center;font-size:14px;line-height:1.35;font-weight:800}.plans{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.plan{position:relative;min-height:6.48in;padding:.2in;border:2px solid var(--plan);border-top:10px solid var(--plan);border-radius:14px;background:white;box-shadow:0 14px 30px rgba(7,20,38,.1)}.plan>p{margin:0;color:#36506a;font-size:11px;font-weight:950;letter-spacing:.15em}.plan h2{margin:.07in 0 0;color:var(--plan);font-family:Impact,"Arial Narrow",sans-serif;font-size:45px}.plan h2 span{margin-left:6px;color:#071426;font:900 13px "Segoe UI",Arial}.plan>strong{display:block;margin-bottom:.12in;font-size:13px}.plan ul{margin:0;padding:0;list-style:none}.plan li{position:relative;padding:.085in 0 .085in .2in;border-top:1px solid #dce3e9;font-size:10px;line-height:1.3;font-weight:720}.plan li:before{content:"+";position:absolute;left:0;color:#398c2c;font-weight:950}.plan>a{position:absolute;left:.2in;right:1.22in;bottom:.2in;padding:.1in;border-radius:8px;background:var(--plan);color:#071426;text-align:center;text-decoration:none;font-family:Impact,"Arial Narrow",sans-serif;font-size:18px}.plan-qr{position:absolute;right:.18in;bottom:.14in;width:.8in;text-align:center}.plan-qr img{width:.75in;padding:4px;border:4px solid #071426;border-radius:8px;background:white}.plan-qr span{display:block;font-size:5px;font-weight:900}.decision{margin-top:.17in;padding:.14in;background:#071426;color:white;border-radius:13px}.decision h2{margin:0 0 .1in;color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:19px}.decision>div{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:.09in;align-items:start}.decision b{padding-left:.08in;border-left:3px solid #e31837;font-size:8px}.decision span{font-size:7px;line-height:1.35}.pricing-footer{display:grid;grid-template-columns:1.25fr 1fr;gap:.16in;margin-top:.12in;padding:.1in;border-top:2px solid #e31837}.pricing-footer strong,.pricing-footer span{font-size:8px;line-height:1.35}.concept-sheet{width:8.5in;height:11in;padding:.28in;background:radial-gradient(circle at 90% 0,#dff7ff,transparent 30%),#f7f8f5}.concept-head{display:grid;grid-template-columns:1.45in 1fr 1.7in;gap:.18in;align-items:center;padding:.16in .18in;background:#071426;color:white;border-radius:14px}.concept-head>img:first-child{width:1.35in;padding:6px;background:white;border-radius:6px}.concept-head>img:last-child{width:1.55in}.concept-head p{margin:0;color:#e31837;font-size:8px;font-weight:950;letter-spacing:.16em}.concept-head h1{margin:4px 0 0;font-family:Impact,"Arial Narrow",sans-serif;font-size:21px}.concept-head h1 em{display:block;color:#58dfff;font-style:normal}.concept-hero{display:grid;grid-template-columns:2.35in 1fr;gap:.18in;align-items:center;margin-top:.18in}.concept-hero h2{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:29px;line-height:.96}.concept-hero h2 em{color:#4ecf72;font-style:normal}.concept-hero>div>p:last-child{font-size:10px;line-height:1.4;font-weight:700}.concept-hero .proof{height:3.35in;margin:0}.concept-roles{display:grid;gap:.11in;margin-top:.2in}.concept-roles article{display:grid;grid-template-columns:2.35in 1fr;gap:.18in;min-height:1.55in;padding:.09in;background:white;border-left:6px solid #e31837}.concept-roles article:nth-child(2){border-color:#9bea18}.concept-roles article:nth-child(3){border-color:#58dfff}.concept-roles img{width:100%;height:1.37in;object-fit:cover;object-position:top;border-radius:7px}.concept-roles div{display:grid;align-content:center;gap:6px}.concept-roles b{font-family:Impact,"Arial Narrow",sans-serif;font-size:19px}.concept-roles span{font-size:10px;line-height:1.4;font-weight:680}.concept-close{display:grid;grid-template-columns:2.4in 1fr;gap:.16in;margin-top:.18in;padding:.15in;background:#071426;color:white;border-top:5px solid #e31837}.concept-close b{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:17px}.concept-close span{font-size:8px;line-height:1.4}
  .concept-hero .proof{height:3.05in}
  `
}

function deckCss() {
  return `
  @page{margin:0}*{box-sizing:border-box}html,body{margin:0;width:1600px;height:900px;overflow:hidden}body{font-family:"Segoe UI",Arial,sans-serif;color:white;background:#061326;-webkit-print-color-adjust:exact}.slide{position:relative;width:1600px;height:900px;overflow:hidden;padding:62px 72px;background:radial-gradient(circle at 95% 0,rgba(96,223,255,.16),transparent 32%),radial-gradient(circle at 0 100%,rgba(227,24,55,.14),transparent 30%),#061326}.slide:after{content:"";position:absolute;left:72px;right:72px;bottom:35px;height:3px;background:linear-gradient(90deg,#e31837,#9bea18,#58dfff,transparent)}.cover{height:100%;display:grid;align-content:center}.cover-logos{position:absolute;left:72px;top:48px;display:flex;align-items:center;gap:18px}.cover-logos img:first-child{width:275px;padding:11px;background:white;border-radius:12px}.cover-logos img:last-child{width:275px}.cover-logos span{width:150px;color:#58dfff;font-size:12px;line-height:1.35;font-weight:950;letter-spacing:.12em}.cover-copy{max-width:1180px}.cover-copy>p,.deck-kicker{margin:0 0 18px;color:#9bea18;font-size:20px;font-weight:950;letter-spacing:.2em;text-transform:uppercase}.cover h1,.deck-title h2,.deck-copy h2{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:94px;line-height:.93}.cover h1 em,.deck-title h2 em,.deck-copy h2 em{color:#58dfff;font-style:normal}.cover-copy>span{display:block;margin-top:30px;max-width:1050px;color:#dbe5ef;font-size:27px;line-height:1.35;font-weight:720}.cover-band{position:absolute;right:72px;bottom:58px;padding:14px 18px;border-left:6px solid #e31837;background:#10243c;color:#dbe5ef;font-size:13px;font-weight:900;letter-spacing:.06em}.deck-title{max-width:1400px}.deck-title h2,.deck-copy h2{font-size:61px}.program-lines{display:grid;gap:26px;margin-top:58px}.program-lines>div{display:grid;grid-template-columns:240px 1fr;align-items:center;padding:22px 25px;border-left:8px solid #e31837;background:#0d2037}.program-lines>div:nth-child(2){border-color:#9bea18}.program-lines>div:nth-child(3){border-color:#58dfff}.program-lines b{font-family:Impact,"Arial Narrow",sans-serif;font-size:38px}.program-lines span{color:#dbe5ef;font-size:24px;font-weight:700}.source-line{margin:18px 0 0;color:#8fa3b9;font-size:14px}.deck-statement{margin-top:24px;padding:19px 24px;background:#e31837;color:white;font-size:23px;font-weight:850}.flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:17px;align-items:stretch;margin-top:72px}.flow>div{display:grid;align-content:start;gap:13px;min-height:290px;padding:30px 26px;border-top:8px solid #58dfff;background:#0d2037}.flow>div:nth-of-type(2n){border-color:#9bea18}.flow b{color:#58dfff;font-family:Impact,"Arial Narrow",sans-serif;font-size:62px}.flow strong{font-size:22px}.flow span{color:#becbd9;font-size:17px;line-height:1.4;font-weight:650}.flow i{align-self:center;color:#9bea18;font-size:32px;font-style:normal}.flow-note{margin:32px 0 0;padding:18px 22px;border-left:6px solid #e31837;background:#091a30;color:#dbe5ef;font-size:20px;font-weight:750}.split{height:100%;display:grid;grid-template-columns:.92fr 1.08fr;gap:62px;align-items:center}.deck-copy>p:not(.deck-kicker){color:#d5dfeb;font-size:24px;line-height:1.45;font-weight:650}.statement{display:block;margin-top:32px;padding-left:20px;border-left:6px solid #9bea18;color:#9bea18;font-size:29px}.deck-proof{margin:0;overflow:hidden;border:7px solid #13263e;border-radius:24px;background:#071426;box-shadow:0 25px 70px rgba(0,0,0,.35)}.deck-proof img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}.deck-proof figcaption{padding:12px 18px;background:#12223a;color:#58dfff;font-size:15px;font-weight:900;letter-spacing:.06em}.split .deck-proof{height:640px}.role-proof{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:35px}.role-proof article{overflow:hidden;border-top:7px solid #58dfff;background:#0b1d34}.role-proof article:nth-child(2){border-color:#9bea18}.role-proof article:nth-child(3){border-color:#e31837}.role-proof figure{height:320px;margin:0;overflow:hidden}.role-proof img{width:100%;height:100%;object-fit:cover;object-position:top}.role-proof p{margin:20px 24px 8px;color:#9bea18;font-size:18px;font-weight:950;letter-spacing:.16em}.role-proof span{display:block;margin:0 24px 25px;color:#d5dfeb;font-size:18px;line-height:1.4;font-weight:650}.competition-proof{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:32px}.competition-proof .deck-proof{height:350px}.policy-row{display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr;gap:14px;align-items:center;margin-top:28px;padding:22px;background:#0d2037}.policy-row b{color:#9bea18;font-size:15px}.policy-row span{color:#d5dfeb;font-size:14px;line-height:1.3}.deck-plans{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}.deck-plans>div{min-height:430px;padding:35px;border-top:10px solid #58dfff;background:#0d2037}.deck-plans .recommended{border-color:#9bea18}.deck-plans p{margin:0;color:#d5dfeb;font-size:19px;font-weight:950;letter-spacing:.15em}.deck-plans strong{display:block;margin-top:15px;color:#58dfff;font-family:Impact,"Arial Narrow",sans-serif;font-size:78px}.deck-plans .recommended strong{color:#9bea18}.deck-plans strong span{font:900 18px "Segoe UI",Arial}.deck-plans ul{margin:22px 0 0;padding-left:22px}.deck-plans li{margin:12px 0;color:#d5dfeb;font-size:18px;line-height:1.3}.pricing-boundary{margin:25px 0 0;padding:16px 20px;border-left:6px solid #e31837;background:#091a30;color:#dbe5ef;font-size:18px;font-weight:750}.decision-list{display:grid;gap:18px;margin-top:38px}.decision-list>div{display:grid;grid-template-columns:90px 250px 1fr;gap:24px;align-items:center;padding:21px 25px;border-left:7px solid #58dfff;background:#0d2037}.decision-list>div:nth-child(2){border-color:#9bea18}.decision-list>div:nth-child(3){border-color:#e31837}.decision-list b{color:#58dfff;font-family:Impact,"Arial Narrow",sans-serif;font-size:42px}.decision-list strong{font-size:22px}.decision-list span{color:#d5dfeb;font-size:20px;font-weight:650}.deck-close{display:flex;gap:22px;align-items:center;position:absolute;left:72px;right:72px;bottom:55px;padding:18px 22px;background:#e31837}.deck-close b{font-size:18px}.deck-close span{font-size:19px;font-weight:750}
  .deck-proof img{height:calc(100% - 43px)}.split .deck-proof{height:470px}.split .deck-proof img{object-fit:contain;background:#071426}.role-proof figure{height:270px}
  `
}

function executiveBrief() {
  return `# TenAceIQ x Vetta executive brief

## The message

Vetta already offers a broad racquet-sports experience. TenAceIQ Club connects the member identity and tennis context around the systems Vetta already uses.

## Why Vetta would pay

- A current TenAceIQ member keeps the same Player ID and public tennis history.
- A new member can be invited and connected to the correct Player ID.
- One person can hold multiple Vetta roles without creating duplicate tennis profiles.
- Club context follows players into My Lab, coaches into Coach Hub, captains into Team Hub, and organizers into League Office and Tournament Desk.
- Vetta chooses whether each competition is TIQ rated, public history only, or social/event only.
- Vetta can apply its own logo, color, programs, people, and competition structure.

## Pricing to state exactly

- Club Starter: $99/month for one branded Club workspace, up to 10 coaches or staff, and up to 150 connected players.
- Club Unlimited: $149/month for one branded Club workspace with unlimited coaches, staff, and connected players.

Both plans use the same premium Club product. The difference is capacity.

## Important Vetta scoping decision

Do not promise that $149 automatically covers a separate workspace for every Vetta location. First decide whether Vetta wants one organization-wide racquet workspace or separate workspaces by location. If separate workspaces are preferred, scope the commercial structure before quoting.
`
}

function runOfShow() {
  return `# TenAceIQ x Vetta meeting run of show

## Meeting objective

Leave with one clear workspace model, one first member journey, one Vetta owner, and one date to scope activation.

## Recommended 30-minute flow

### 0-4 minutes - establish the opportunity

Vetta already has the programs. The opportunity is continuity between the program page, the coach, the player, the team, and the competition.

### 4-10 minutes - understand the current member journey

Ask where Vetta members lose context today, which questions staff repeat, and what happens between a lesson and the next session.

### 10-20 minutes - show one connected journey

1. Club member home and Player ID connection.
2. My Lab for the player's next useful action.
3. Coach Hub for assignment and follow-through.
4. League Office or Tournament Desk for the result policy.

Do not tour every feature. Follow one believable member from role connection to action.

### 20-26 minutes - define the workspace

Decide whether the first Club workspace represents all Vetta Racquet Sports or one location. Confirm the expected number of coaches/staff and connected players.

### 26-30 minutes - secure the next step

Name the Vetta owner, first member journey, first group, and a 45-minute activation-scoping date.
`
}

function discoveryQuestions() {
  return `# Vetta discovery questions

## Workspace

- Should members experience one Vetta Racquet Sports identity across locations, or a distinct Club home for each location?
- Which programs and locations should appear together?
- Who owns branding, roles, and member invitations?

## Member identity and data

- How should Vetta recognize an existing TenAceIQ member?
- Who should approve Player ID matches when a name is ambiguous?
- Which staff roles need access to player development context?

## Player and coach experience

- What should happen after a lesson or clinic session?
- Which goals, assignments, tactics, video, or proof should carry into My Lab?
- Which coaches need to see progress across programs?

## Competition

- Which leagues or tournaments should update TIQ ratings?
- Which should appear in public player history without changing ratings?
- Which social events should remain local only?

## Capacity and rollout

- Will the first workspace exceed 10 coaches/staff or 150 connected players?
- Which member journey gives Vetta the clearest first proof of value?
`
}

function sourcesAndClaims() {
  return `# Sources and claims

## Vetta sources

- Vetta Sports racquet sports overview: https://vettasports.com/racquet-sports/
- Vetta Sports adult tennis programs: https://vettasports.com/racquet-sports/adult-tennis/
- Vetta Sports locations: https://vettasports.com/locations/
- Vetta Sports outdoor tennis: https://vettasports.com/racquet-sports/outdoor-tennis/

Accessed August 12, 2026. These official pages support the statements that Vetta offers indoor and outdoor racquet programs, youth and adult tennis, clinics, lessons, teams, leagues, and programs across multiple locations.

## TenAceIQ sources

- Product and pricing language: lib/product-story.ts in the verified Club build.
- Product screenshots: artifacts/club-experience-audit in the verified Club build.
- Club Starter: $99/month, one branded workspace, up to 10 coaches or staff, up to 150 connected players.
- Club Unlimited: $149/month, one branded workspace, unlimited coaches, staff, and connected players.

## Concept boundary

Vetta is a prospective customer. The Vetta logo and brand treatment are used only to illustrate a potential customer experience. Northstar Tennis Club is a fictional TenAceIQ QA club used for verified product screenshots. No Vetta subscription, partnership, live account, or agreed rollout is implied.
`
}

function readme() {
  return `# TenAceIQ x Vetta sales package

This package rebuilds the Vetta conversation around the finished TenAceIQ Club product.

## Folder guide

- 01-one-pagers: executive summary and pricing/rollout comparison in PDF, PNG, and JPG.
- 02-executive-deck: eight-page presentation PDF plus individual slide PNGs.
- 03-verified-product-proof: current Club, My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk screenshots.
- 04-meeting-guide: executive brief, run of show, discovery questions, and source notes.
- 05-vetta-brand-concept: Vetta-branded proposal concept and the official logo asset used in the package.

## Central message

Vetta already has the programs. TenAceIQ Club connects the member identity, development story, team decisions, leagues, and tournaments around the systems Vetta already uses.

## Pricing

- Club Starter: $99/month for one branded Club workspace, up to 10 coaches or staff, and up to 150 connected players.
- Club Unlimited: $149/month for one branded Club workspace with unlimited coaches, staff, and connected players.

The package intentionally does not claim that Club Unlimited includes a separate workspace for every Vetta location. The workspace structure must be scoped first.
`
}

function qrOptions() {
  return { width: 260, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#071426', light: '#ffffff' } }
}

async function dataUri(file) {
  const bytes = await readFile(file)
  const extension = path.extname(file).toLowerCase()
  const mime = extension === '.svg' ? 'image/svg+xml' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}
