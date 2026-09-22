import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.')
const output = path.join(root, 'output', 'vetta-meeting', '05-vetta-brand-concept')
const liveClub = path.join(root, 'tmp', 'pdfs', 'live-value-first', 'club.png')
const tiqLogo = path.join(root, 'public', 'brand', 'web', 'header-logo-transparent.png')
const vettaLogoUrl = 'https://vettasports.com/wp-content/themes/vetta-sports/img/logo/vetta-logo.svg'

await mkdir(output, { recursive: true })
const vettaLogoPath = path.join(output, 'vetta-logo-current.svg')
const vettaLogoResponse = await fetch(vettaLogoUrl)
if (!vettaLogoResponse.ok) throw new Error(`Unable to download Vetta logo: ${vettaLogoResponse.status}`)
await writeFile(vettaLogoPath, await vettaLogoResponse.text(), 'utf8')

const clubData = `data:image/png;base64,${(await readFile(liveClub)).toString('base64')}`
const tiqData = `data:image/png;base64,${(await readFile(tiqLogo)).toString('base64')}`
const vettaData = `data:image/svg+xml;base64,${(await readFile(vettaLogoPath)).toString('base64')}`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1600px;height:1000px;overflow:hidden}body{font-family:"Segoe UI",Arial,sans-serif;background:#f4f2ee;color:#071426}.canvas{position:relative;width:1600px;height:1000px;padding:54px 62px 44px;background:radial-gradient(circle at 100% 0%,rgba(227,24,55,.12),transparent 440px),#f7f6f2}.top{height:108px;display:flex;align-items:center;justify-content:space-between;padding:14px 28px;background:#071426;border-radius:24px}.logos{display:flex;align-items:center;gap:22px}.vetta{width:250px;height:80px;padding:8px 14px;background:#fff;border-radius:14px;object-fit:contain;filter:drop-shadow(0 3px 6px rgba(0,0,0,.18))}.powered{color:#aab8c5;font-size:16px;font-weight:800;letter-spacing:.12em}.tiq{width:245px;height:72px;object-fit:contain}.concept{display:flex;align-items:center;gap:12px;color:#fff;font-size:16px;font-weight:900;letter-spacing:.11em}.concept i{display:block;width:12px;height:12px;border-radius:50%;background:#e31837}.intro{margin-top:35px;display:flex;align-items:flex-end;justify-content:space-between}.intro h1{margin:0;font-family:Impact,"Arial Narrow",Arial,sans-serif;font-size:68px;line-height:.94;letter-spacing:.01em;text-transform:uppercase}.intro h1 strong{display:block;color:#e31837}.intro p{margin:0 0 6px;width:520px;font-size:23px;line-height:1.3;font-weight:750}.product{position:relative;margin-top:30px;height:590px;overflow:hidden;background:#071426;border:8px solid #071426;outline:5px solid #e31837;border-radius:26px;box-shadow:0 28px 65px rgba(7,20,38,.24)}.product>img{width:100%;height:100%;object-fit:contain;opacity:.56;filter:saturate(.75)}.chrome{position:absolute;inset:0;padding:27px 35px;display:flex;flex-direction:column}.clubbar{height:132px;display:flex;align-items:center;justify-content:space-between;padding:20px 25px;background:linear-gradient(110deg,#331016,#071426 66%);border:2px solid rgba(227,24,55,.6);border-radius:18px;color:#fff}.clubbrand{display:flex;align-items:center;gap:23px}.mark{width:138px;height:82px;padding:8px 12px;background:#fff;border-radius:13px;object-fit:contain}.clubbrand small{display:block;color:#ff8294;font-size:13px;font-weight:900;letter-spacing:.18em}.clubbrand h2{margin:6px 0 0;font-size:34px}.clubbrand span{display:block;margin-top:5px;color:#dce4ed;font-size:17px}.clubbar>span{max-width:420px;text-align:right;font-size:20px;line-height:1.3;font-weight:800}.tabs{height:60px;margin-top:17px;padding:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:7px;background:#071426;border:1px solid #33455a;border-radius:14px}.tabs b{display:flex;align-items:center;justify-content:center;color:#e9eef3;font-size:16px}.tabs b:first-child{background:#e31837;color:#fff;border-radius:9px}.workspace{margin-top:18px;display:grid;grid-template-columns:1.3fr .9fr;gap:18px;flex:1}.workspace article{padding:26px 29px;background:rgba(7,20,38,.93);border:1px solid #40536a;border-radius:18px;color:#fff}.workspace small{color:#ff8294;font-size:13px;font-weight:900;letter-spacing:.16em}.workspace h3{margin:12px 0 9px;font-size:28px}.workspace p{margin:0;color:#cdd7e1;font-size:18px;line-height:1.35}.next{margin-top:23px;padding:15px 18px;background:#e31837;border-radius:10px;font-size:17px;font-weight:900;width:max-content}.list{display:grid;gap:13px;margin-top:18px}.list div{padding:14px 16px;background:#11243a;border-left:5px solid #e31837;border-radius:8px}.list b{display:block;font-size:17px}.list span{display:block;margin-top:4px;color:#cbd5df;font-size:14px}.foot{position:absolute;left:62px;right:62px;bottom:18px;display:flex;justify-content:space-between;font-size:13px;font-weight:900;letter-spacing:.11em}.foot b{color:#c31832}
</style></head><body><main class="canvas"><header class="top"><div class="logos"><img class="vetta" src="${vettaData}"><span class="powered">MEMBER EXPERIENCE POWERED BY</span><img class="tiq" src="${tiqData}"></div><div class="concept"><i></i>VETTA CLUB CONCEPT</div></header><section class="intro"><h1>ONE VETTA HOME.<strong>EVERY TENNIS ROLE MOVING.</strong></h1><p>A branded member experience for players, coaches, programs, teams, leagues, and tournaments—around Vetta's existing systems.</p></section><section class="product"><img src="${clubData}"><div class="chrome"><div class="clubbar"><div class="clubbrand"><img class="mark" src="${vettaData}"><div><small>VETTA RACQUET SPORTS</small><h2>Where St. Louis Plays Tennis</h2><span>Member home · St. Louis and St. Charles</span></div></div><span>One connected tennis experience across Vetta programs and locations.</span></div><div class="tabs"><b>Home</b><b>Schedule</b><b>People</b><b>Programs</b><b>Compete</b><b>Vetta</b></div><div class="workspace"><article><small>START HERE</small><h3>Your Vetta tennis week, in one place.</h3><p>See the next program, team, coaching, or competition action without searching across disconnected updates.</p><div class="next">OPEN MY TENNIS WEEK →</div></article><article><small>WHAT'S NEXT</small><div class="list"><div><b>Junior Team Tennis</b><span>Thursday · Vetta West</span></div><div><b>Coach follow-through</b><span>One assignment ready in My Lab</span></div><div><b>Interclub match week</b><span>Availability and lineup context</span></div></div></article></div></div></section><footer class="foot"><span>CONCEPT MOCKUP · LIVE TENACEIQ CLUB VIEW AS FOUNDATION</span><b>VETTA × TENACEIQ</b></footer></main></body></html>`

const htmlPath = path.join(output, 'vetta-club-concept.html')
await writeFile(htmlPath, html, 'utf8')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  await page.goto(`file:///${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' })
  await page.evaluate(async () => Promise.all(Array.from(document.images).map((img) => img.decode())))
  const pngPath = path.join(output, 'TenAceIQ-Vetta-Club-Concept.png')
  await page.screenshot({ path: pngPath, type: 'png' })
  await page.screenshot({ path: path.join(output, 'TenAceIQ-Vetta-Club-Concept.jpg'), type: 'jpeg', quality: 91 })
  await sharp(pngPath).metadata().then((meta) => {
    if (meta.width !== 1600 || meta.height !== 1000) throw new Error(`Unexpected mockup dimensions: ${meta.width}x${meta.height}`)
  })
} finally { await browser.close() }
