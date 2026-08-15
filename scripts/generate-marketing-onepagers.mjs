import { chromium } from '@playwright/test'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '..')
const liveDir = path.join(rootDir, 'tmp', 'pdfs', 'live-value-first')
const htmlDir = path.join(rootDir, 'tmp', 'pdfs', 'marketing-html')
const outputDir = path.join(rootDir, 'output', 'pdf')
const imageOutputDir = path.join(rootDir, 'output', 'marketing-images')
const fullPageImageDir = path.join(imageOutputDir, 'full-page')
const socialImageDir = path.join(imageOutputDir, 'social-4x5')
const carouselImageDir = path.join(imageOutputDir, 'carousels')
const storyImageDir = path.join(imageOutputDir, 'stories-9x16')
const liveHeaderLogoPath = path.join(rootDir, 'public', 'brand', 'web', 'header-logo-transparent.png')
const marketingAssetDir = path.join(rootDir, 'public', 'brand', 'marketing')

await Promise.all([
  mkdir(htmlDir, { recursive: true }),
  mkdir(outputDir, { recursive: true }),
  mkdir(fullPageImageDir, { recursive: true }),
  mkdir(socialImageDir, { recursive: true }),
  mkdir(carouselImageDir, { recursive: true }),
  mkdir(storyImageDir, { recursive: true }),
])

const brandLogoBytes = await sharp(liveHeaderLogoPath)
  .flatten({ background: '#071426' })
  .png({ compressionLevel: 9 })
  .toBuffer()
const courtTextureBytes = await sharp(path.join(marketingAssetDir, 'green-court-texture.png'))
  .resize(720, 1080, { fit: 'cover' })
  .jpeg({ quality: 90, mozjpeg: true })
  .toBuffer()

const outcomeIconBytes = []
for (const iconName of ['target', 'clipboard', 'racket']) {
  const bytes = await sharp(path.join(marketingAssetDir, `value-icon-${iconName}-transparent.png`))
    .png({ compressionLevel: 9 })
    .toBuffer()
  outcomeIconBytes.push(bytes)
}

const closeArrowBytes = await sharp(path.join(marketingAssetDir, 'value-arrow-transparent.png'))
  .png({ compressionLevel: 9 })
  .toBuffer()

const pageVisualSources = {}
for (const key of ['free', 'player', 'coach', 'captain', 'league', 'full-court', 'club', 'pricing']) {
  const logoFile = `tenaceiq-live-header-logo-${key}.png`
  const courtFile = `tenaceiq-green-court-${key}.jpg`
  const arrowFile = `tenaceiq-value-arrow-${key}.png`
  await Promise.all([
    writeFile(path.join(htmlDir, logoFile), brandLogoBytes),
    writeFile(path.join(htmlDir, courtFile), courtTextureBytes),
    writeFile(path.join(htmlDir, arrowFile), closeArrowBytes),
    ...outcomeIconBytes.map((bytes, index) => writeFile(path.join(htmlDir, `tenaceiq-value-icon-${index + 1}-${key}.png`), bytes)),
  ])
  pageVisualSources[key] = {
    logo: `./${logoFile}`,
    court: `./${courtFile}`,
    arrow: `./${arrowFile}`,
    icons: outcomeIconBytes.map((_, index) => `./tenaceiq-value-icon-${index + 1}-${key}.png`),
  }
}

const tiers = [
  {
    slug: 'free',
    name: 'Free',
    accent: '#9be11d',
    railTitleTop: 'FIND FASTER.',
    railTitleAccent: 'KNOW MORE.',
    compareLead: 'START WITH THE WHOLE TENNIS LANDSCAPE.',
    comparePaid: 'FREE PUTS PUBLIC TENNIS CONTEXT IN ONE PLACE.',
    core: 'Free brings players, teams, leagues, rankings, tournaments, and public tennis context into one searchable starting point.',
    why: 'You get a faster answer before deciding which paid tool belongs in your tennis life.',
    price: '$0',
    priceNote: 'FREE ACCOUNT',
    cta: 'START EXPLORING',
    support: 'No card required. Upgrade only when you want tools built around your role.',
    screenshot: 'free-explore.png',
    screenshotLabel: 'LIVE VIEW: EXPLORE',
    screenshotUrl: 'tenaceiq.com/explore',
    ctaUrl: 'https://www.tenaceiq.com/join',
    displayUrl: 'tenaceiq.com/join',
    close: 'START WITH THE CONTEXT. CHOOSE A ROLE WHEN YOU NEED MORE.',
    outcomes: [
      {
        title: 'FIND TENNIS CONTEXT FAST',
        benefit: 'Search one place instead of chasing scattered sources.',
        tools: 'Players, teams, leagues, rankings, tournaments, coaches, and resources.',
      },
      {
        title: 'UNDERSTAND BEFORE YOU ACT',
        benefit: 'See the field before a match, lineup, or tennis conversation.',
        tools: 'Public player profiles, team context, standings, rankings, and results.',
      },
      {
        title: 'HELP KEEP THE READ CURRENT',
        benefit: 'Contribute trusted source records when tennis data needs a refresh.',
        tools: 'Data Assist uploads for scorecards, schedules, and team summaries.',
      },
    ],
  },
  {
    slug: 'player',
    name: 'Player',
    accent: '#9be11d',
    railTitleTop: 'STOP GUESSING.',
    railTitleAccent: 'KNOW YOUR NEXT MOVE.',
    compareLead: 'FREE HELPS YOU FIND TENNIS.',
    comparePaid: 'PLAYER MAKES TENACEIQ YOURS.',
    core: 'Player unlocks My Lab and the tools that turn your tennis context into a personal plan - for what to follow, what to practice, and how to prepare.',
    why: 'You are paying for a connected player experience - not another pile of tennis data.',
    price: '$4.99',
    priceNote: '/ MONTH',
    cta: 'UNLOCK MY LAB',
    support: 'Start with Free. Upgrade when you want TenAceIQ built around your game.',
    screenshot: 'player-mylab.png',
    screenshotLabel: 'LIVE VIEW: MY LAB',
    screenshotUrl: 'tenaceiq.com/mylab',
    ctaUrl: 'https://www.tenaceiq.com/upgrade?plan=player_plus&next=%2Fprofile',
    displayUrl: 'tenaceiq.com/upgrade?plan=player_plus',
    close: 'READY TO MAKE TENACEIQ YOURS?',
    outcomes: [
      {
        title: 'MAKE TENACEIQ YOURS',
        benefit: 'Choose your Player ID and make My Lab personal.',
        tools: 'Follow players, teams, and leagues. Keep your tennis context and messages together.',
      },
      {
        title: 'TURN INSIGHT INTO COURT WORK',
        benefit: 'Know what to practice and prove the work.',
        tools: 'Level Up cards, My Quest goals and streaks, Tactics Boards, and saved serve or stroke clips.',
      },
      {
        title: "PREPARE FOR WHO'S NEXT",
        benefit: 'Walk into the next match with context and a plan.',
        tools: 'Matchup prep, who-to-play-next context, refreshed player data, and saved notes.',
      },
    ],
  },
  {
    slug: 'coach',
    name: 'Coach',
    accent: '#b48cff',
    railTitleTop: 'COACH THE HOUR.',
    railTitleAccent: 'KEEP PROGRESS MOVING.',
    compareLead: 'PLAYER BUILDS ONE GAME.',
    comparePaid: 'COACH KEEPS EVERY PLAYER MOVING BETWEEN SESSIONS.',
    core: 'Coach includes Player, then adds Coach Hub to turn every lesson into assigned work, visible progress, and a clear next step.',
    why: 'You are paying to see what each player needs, send the next useful action, and know what happened before the next session.',
    price: '$9.99',
    priceNote: '/ MONTH',
    cta: 'UNLOCK COACH',
    support: 'Best for private coaches, school coaches, and training-group leaders.',
    screenshot: 'coach-hub.png',
    screenshotLabel: 'LIVE VIEW: COACH HUB',
    screenshotUrl: 'tenaceiq.com/coach',
    ctaUrl: 'https://www.tenaceiq.com/upgrade?plan=coach&next=%2Fcoach',
    displayUrl: 'tenaceiq.com/upgrade?plan=coach',
    close: 'READY TO GIVE EVERY PLAYER THE NEXT USEFUL STEP?',
    outcomes: [
      {
        title: 'SEE WHO NEEDS WHAT NEXT',
        benefit: 'Open one player and start with the work that matters now.',
        tools: 'Player bench, goals, lesson context, assignments, check-ins, proof, and progress history.',
      },
      {
        title: 'TURN THE LESSON INTO A NEXT STEP',
        benefit: 'Send one clear rep, habit, or tactical idea beyond the court.',
        tools: 'Drill assignments, Level Up work, custom habits, and TIQ Tactical Studio boards.',
      },
      {
        title: 'COACH BETWEEN SESSIONS',
        benefit: 'Review the proof, respond faster, and begin the next lesson informed.',
        tools: 'Video review, timestamped feedback, saved proof, player messages, and progress history.',
      },
    ],
  },
  {
    slug: 'captain',
    name: 'Captain',
    accent: '#f4a340',
    railTitleTop: 'STOP CHASING TEXTS.',
    railTitleAccent: 'LEAD THE WEEK.',
    compareLead: 'PLAYER BUILDS YOUR GAME.',
    comparePaid: 'CAPTAIN BUILDS YOUR MATCH WEEK.',
    core: 'Captain includes Player, then adds Team Hub and Captain Tools for availability, lineups, pairings, scouting, readiness, and team communication.',
    why: 'You are paying for clearer lineup decisions and fewer follow-ups before match day.',
    price: '$9.99',
    priceNote: '/ MONTH',
    cta: 'UNLOCK CAPTAIN',
    support: 'Best for captains who want less chasing and a lineup they can explain.',
    screenshot: 'captain-hub.png',
    screenshotLabel: 'LIVE VIEW: TEAM HUB',
    screenshotUrl: 'tenaceiq.com/captain',
    ctaUrl: 'https://www.tenaceiq.com/upgrade?plan=captain&next=%2Fcaptain',
    displayUrl: 'tenaceiq.com/upgrade?plan=captain',
    close: 'READY TO RUN MATCH WEEK WITH LESS CHAOS?',
    outcomes: [
      {
        title: 'KNOW WHO CAN PLAY',
        benefit: 'See availability and readiness before you start building.',
        tools: 'Player status, team contacts, roster context, and match-week readiness.',
      },
      {
        title: 'BUILD A LINEUP YOU TRUST',
        benefit: 'Compare the choices before you commit the courts.',
        tools: 'Lineup builder, pairing comparisons, player scouting, and opponent context.',
      },
      {
        title: 'SEND ONE CLEAR PLAN',
        benefit: 'Move the team from questions to match-day action.',
        tools: 'Team messages, court plans, availability follow-up, and weekly recap tools.',
      },
    ],
  },
  {
    slug: 'league',
    name: 'League',
    accent: '#32c5df',
    railTitleTop: 'RUN THE SEASON.',
    railTitleAccent: 'NOT THE CLEANUP.',
    compareLead: 'FREE SHOWS THE TENNIS LANDSCAPE.',
    comparePaid: 'LEAGUE GIVES YOUR SEASON A SYSTEM.',
    core: 'League unlocks League Office for one league, ladder, or tournament season with participants, schedules, scores, standings, and member visibility.',
    why: 'You are paying to replace spreadsheet cleanup and scattered updates with one clear competition flow.',
    price: '$25',
    priceNote: '/ SEASON',
    cta: 'UNLOCK LEAGUE',
    support: 'One bounded season for player or team competition.',
    screenshot: 'league-office.png',
    screenshotLabel: 'LIVE VIEW: LEAGUE OFFICE',
    screenshotUrl: 'tenaceiq.com/league-coordinator',
    ctaUrl: 'https://www.tenaceiq.com/upgrade?plan=league&next=%2Fleague-coordinator',
    displayUrl: 'tenaceiq.com/upgrade?plan=league',
    close: 'READY TO GIVE THE SEASON ONE CLEAR HOME?',
    outcomes: [
      {
        title: 'STRUCTURE THE COMPETITION',
        benefit: 'Set up the season before participants enter.',
        tools: 'Player or team approval, league format, divisions, sites, and season settings.',
      },
      {
        title: 'KEEP WHO, WHEN, AND WHERE VISIBLE',
        benefit: 'Give members one reliable place for the next detail.',
        tools: 'Schedules, match sites, participants, public pages, and organizer updates.',
      },
      {
        title: 'TURN SCORES INTO STANDINGS',
        benefit: 'Close the loop without rebuilding the table by hand.',
        tools: 'Results, score review, corrections, standings, rankings, and Data Assist uploads.',
      },
    ],
  },
  {
    slug: 'full-court',
    name: 'Full-Court',
    accent: '#e65cff',
    railTitleTop: 'EVERY ROLE.',
    railTitleAccent: 'ONE CONNECTED PLAN.',
    compareLead: 'ONE ROLE NEEDS ONE TOOL.',
    comparePaid: 'FULL-COURT CONNECTS EVERY TENNIS ROLE YOU SUPPORT.',
    core: 'Full-Court combines My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk tools in one account.',
    why: 'You are paying to stop switching between disconnected plans as you coach, captain, organize, and compete.',
    price: '$19.99',
    priceNote: '/ MONTH',
    cta: 'UNLOCK FULL-COURT',
    support: 'Best for people supporting players, teams, leagues, and events at once.',
    screenshot: 'player-mylab.png',
    screenshotLabel: 'LIVE CONNECTION: PLAYER + TEAM + LEAGUE',
    screenshotUrl: 'tenaceiq.com/mylab',
    liveProofType: 'connected-workspaces',
    screenshots: [
      { file: 'player-mylab.png', label: 'MY LAB', promise: 'Develop the player' },
      { file: 'captain-hub.png', label: 'TEAM HUB', promise: 'Lead match week' },
      { file: 'league-office.png', label: 'LEAGUE OFFICE', promise: 'Run competition' },
    ],
    ctaUrl: 'https://www.tenaceiq.com/upgrade?plan=full_court&next=%2Fleague-coordinator',
    displayUrl: 'tenaceiq.com/upgrade?plan=full_court',
    close: 'READY TO CONNECT EVERY TENNIS ROLE?',
    outcomes: [
      {
        title: 'DEVELOP PLAYERS',
        benefit: 'Keep personal goals, court work, and coach follow-through connected.',
        tools: 'My Lab, Player ID, follows, Level Up, My Quest, video proof, and Coach Hub.',
      },
      {
        title: 'LEAD TEAMS',
        benefit: 'Move from player context to a cleaner match week.',
        tools: 'Team Hub, availability, lineups, pairings, scouting, readiness, and messages.',
      },
      {
        title: 'RUN COMPETITION',
        benefit: 'Give leagues, ladders, and events one connected operating path.',
        tools: 'League Office plus unlimited Tournament Desk runs, schedules, results, and standings.',
      },
    ],
  },
]

const pricingRows = [
  ['Free', '$0', 'Find public tennis context'],
  ['Player', '$4.99/mo', 'Make TenAceIQ personal'],
  ['Coach', '$9.99/mo', 'Develop players between sessions'],
  ['Captain', '$9.99/mo', 'Lead the whole match week'],
  ['League', '$25/season', 'Run one league, ladder, or event'],
  ['Full-Court', '$19.99/mo', 'Connect every tennis role'],
]

const browser = await chromium.launch({ headless: true })
try {
  const planBookEntries = []
  const trackingRows = []

  for (const tier of tiers) {
    const assets = await buildAssets(tier, tier.ctaUrl)
    const html = shell(tierPage(tier, assets), `TenAceIQ ${tier.name} One-Pager`, `${tier.name} value, pricing, and live TenAceIQ product proof.`)
    const stem = `tenaceiq-${tier.slug}-one-pager`
    await renderPdf(browser, stem, html)
    await renderDigitalImages(browser, stem, html)
    await renderTierCarousel(browser, tier, assets)
    await renderTierStory(browser, tier, assets)
    planBookEntries.push({ stem, clickUrl: assets.clickUrl, liveUrl: assets.liveUrl })
    trackingRows.push([tier.slug, assets.clickUrl, assets.qrUrl, assets.liveUrl])
  }

  const clubTarget = 'https://www.tenaceiq.com/clubs'
  const clubAssets = await buildAssets({ slug: 'club', screenshot: 'club.png', screenshotUrl: 'tenaceiq.com/clubs' }, clubTarget)
  const clubHtml = shell(clubPage(clubAssets), 'TenAceIQ Club One-Pager', 'Club value, pricing, and live TenAceIQ product proof.')
  await renderPdf(browser, 'tenaceiq-club-one-pager', clubHtml)
  await renderDigitalImages(browser, 'tenaceiq-club-one-pager', clubHtml)
  await renderTierCarousel(browser, clubCarouselTier(), clubAssets)
  await renderTierStory(browser, clubCarouselTier(), clubAssets)
  trackingRows.push(['club', clubAssets.clickUrl, clubAssets.qrUrl, clubAssets.liveUrl])

  const pricingTarget = 'https://www.tenaceiq.com/pricing'
  const pricingAssets = await buildAssets({ slug: 'pricing', screenshot: 'pricing.png', screenshotUrl: 'tenaceiq.com/pricing' }, pricingTarget)
  const pricingHtml = shell(pricingPage(pricingAssets), 'TenAceIQ Pricing One-Pager', 'TenAceIQ role pricing and live product proof.')
  await renderPdf(browser, 'tenaceiq-pricing-one-pager', pricingHtml)
  await renderDigitalImages(browser, 'tenaceiq-pricing-one-pager', pricingHtml)
  await renderPricingCarousel(browser, pricingAssets)
  await renderPricingStory(browser)
  trackingRows.push(['pricing', pricingAssets.clickUrl, pricingAssets.qrUrl, pricingAssets.liveUrl])

  await renderRasterBook(browser, [
    { stem: 'tenaceiq-pricing-one-pager', clickUrl: pricingAssets.clickUrl, liveUrl: pricingAssets.liveUrl },
    ...planBookEntries,
    { stem: 'tenaceiq-club-one-pager', clickUrl: clubAssets.clickUrl, liveUrl: clubAssets.liveUrl },
  ])

  await writeFile(
    path.join(imageOutputDir, 'tracking-links.csv'),
    ['asset,click_url,qr_url,live_view_url', ...trackingRows.map((row) => row.map(csvValue).join(','))].join('\n') + '\n',
    'utf8',
  )
} finally {
  await browser.close()
}

async function buildAssets(tier, targetUrl) {
  const clickUrl = trackingUrl(targetUrl, 'pdf', `${tier.slug}_cta`)
  const qrUrl = trackingUrl(targetUrl, 'qr', `${tier.slug}_qr`)
  const liveUrl = trackingUrl(`https://www.${tier.screenshotUrl}`, 'pdf', `${tier.slug}_live_view`)
  const screenshotData = await dataUri(path.join(liveDir, tier.screenshot), 'image/png')
  const screenshotGallery = tier.screenshots
    ? await Promise.all(tier.screenshots.map(async (item) => ({
        ...item,
        data: await dataUri(path.join(liveDir, item.file), 'image/png'),
      })))
    : []
  const qrData = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: { dark: '#071426', light: '#ffffff' },
  })
  return { clickUrl, qrUrl, liveUrl, screenshotData, screenshotGallery, qrData }
}

function tierPage(tier, assets) {
  const productProof = tier.liveProofType === 'connected-workspaces'
    ? liveConnectedWorkspaces(assets.screenshotGallery, tier.screenshotLabel, assets.liveUrl)
    : liveView(assets.screenshotData, tier.screenshotLabel, tier.screenshotUrl, assets.liveUrl)
  return `
    <main class="page tier-${escapeHtml(tier.slug)}" style="--accent:${escapeHtml(tier.accent)}">
      ${rail({
        name: tier.name,
        titleTop: tier.railTitleTop,
        titleAccent: tier.railTitleAccent,
        core: tier.core,
        price: tier.price,
        priceNote: tier.priceNote,
        cta: tier.cta,
        support: tier.support,
        displayUrl: tier.displayUrl,
        ...assets,
      })}
      <section class="main-plane">
        ${comparison(tier.compareLead, tier.comparePaid, tier.why)}
        ${productProof}
        ${outcomeRows(tier.outcomes, tier.name)}
        ${mainClose(tier.close, tier.name, tier.price, tier.priceNote, tier.cta, tier.displayUrl, assets.clickUrl)}
      </section>
    </main>
  `
}

function clubPage(assets) {
  return `
    <main class="page tier-club" style="--accent:#5de279">
      ${rail({
        name: 'Club',
        titleTop: 'CONNECT THE CLUB.',
        titleAccent: 'MOVE EVERY ROLE.',
        core: 'Club brings players, coaches, programs, leagues, tournaments, schedules, and updates into one branded member experience.',
        price: '$99',
        priceNote: '/ MONTH - UP TO 10 COACHES',
        secondaryPrice: '$199 / MONTH - UNLIMITED COACHES',
        cta: 'EXPLORE CLUB',
        support: 'Connect the member experience without replacing your booking or payment system.',
        displayUrl: 'tenaceiq.com/clubs',
        ...assets,
      })}
      <section class="main-plane">
        ${comparison('A PUBLIC PAGE SHOWS THE CLUB.', 'CLUB CONNECTS THE WHOLE MEMBER EXPERIENCE.', 'You are paying to connect the people, programs, and competition around the systems your club already uses.')}
        ${liveView(assets.screenshotData, 'LIVE VIEW: CLUB', 'tenaceiq.com/clubs', assets.liveUrl)}
        ${outcomeRows([
          {
            title: 'GIVE MEMBERS ONE CLUB HOME',
            benefit: 'Make the next schedule, program, or update easy to find.',
            tools: 'Branded public club home, member portal, schedules, rosters, plans, attendance, and updates.',
          },
          {
            title: 'CONNECT PEOPLE AND PROGRAMS',
            benefit: 'Keep every tennis role moving from the same club context.',
            tools: 'Players, coaches, clinics, camps, groups, teams, and connected role experiences.',
          },
          {
            title: 'KEEP COMPETITION WITH THE CLUB',
            benefit: 'Run the tennis without rebuilding the operation elsewhere.',
            tools: 'Reusable league and tournament setups, results, standings, rankings, and club visibility.',
          },
        ], 'Club')}
        ${mainClose('READY TO CONNECT THE WHOLE CLUB?', 'Club', '$99', '/ MONTH - UP TO 10 COACHES', 'EXPLORE CLUB', 'tenaceiq.com/clubs', assets.clickUrl)}
      </section>
    </main>
  `
}

function pricingPage(assets) {
  return `
    <main class="page tier-pricing" style="--accent:#9be11d">
      ${rail({
        name: 'Pricing',
        titleTop: 'START FREE.',
        titleAccent: 'PAY FOR THE JOB YOU NEED.',
        core: 'TenAceIQ tiers are built around real tennis roles - your game, your players, your team, your season, or your whole operation.',
        price: '$0',
        priceNote: 'TO START',
        cta: 'FIND YOUR PLAN',
        support: 'Move up only when a paid tool removes real friction from your tennis life.',
        displayUrl: 'tenaceiq.com/pricing',
        ...assets,
      })}
      <section class="main-plane pricing-plane">
        ${comparison('EVERY PLAN STARTS WITH FREE SEARCH.', 'EACH PAID TIER UNLOCKS ONE CLEAR TENNIS JOB.', 'Choose the role that saves you time, improves a decision, or keeps more of your tennis connected.')}
        ${liveView(assets.screenshotData, 'LIVE VIEW: PRICING', 'tenaceiq.com/pricing', assets.liveUrl, 'pricing-view')}
        <section class="pricing-list" aria-label="TenAceIQ pricing by role">
          ${pricingRows.map(([name, price, job]) => `
            <article>
              <span>${escapeHtml(name)}</span>
              <strong>${escapeHtml(price)}</strong>
              <p>${escapeHtml(job)}</p>
            </article>
          `).join('')}
        </section>
        <section class="club-pricing-line">
          <div><b>CLUB STARTER</b><strong>$99/mo</strong><span>1 location - Up to 10 coaches/staff - 150 player profiles</span></div>
          <div><b>CLUB UNLIMITED</b><strong>$199/mo</strong><span>All locations - Unlimited coaches/staff and player profiles</span></div>
        </section>
        ${mainClose('READY TO CHOOSE THE TOOL THAT FITS?', 'Pricing', 'START', 'WITH FREE', 'FIND YOUR PLAN', 'tenaceiq.com/pricing', assets.clickUrl)}
      </section>
    </main>
  `
}

function rail({ name, titleTop, titleAccent, core, price, priceNote, secondaryPrice, cta, support, displayUrl, clickUrl, qrData }) {
  const visuals = pageVisualSources[visualAssetKey(name)]
  const scanLabel = name === 'Free'
    ? 'SCAN TO START'
    : name === 'Pricing' || name === 'Club'
      ? 'SCAN TO EXPLORE'
      : 'SCAN TO UNLOCK'
  const coreHtml = core.toLowerCase().startsWith(name.toLowerCase())
    ? `<strong>${escapeHtml(core.slice(0, name.length))}</strong>${escapeHtml(core.slice(name.length))}`
    : escapeHtml(core)
  return `
    <aside class="rail">
      <img class="brand-logo" src="${visuals.logo}" alt="TenAceIQ - More Tennis. Less Chaos.">
      <div class="rail-tier">${escapeHtml(name)}</div>
      <h1><span>${escapeHtml(titleTop)}</span><em>${escapeHtml(titleAccent)}</em></h1>
      <p class="rail-core">${coreHtml}</p>
      <div class="rail-price"><small>${escapeHtml(name.toUpperCase())}</small><strong>${escapeHtml(price)}</strong><b>${escapeHtml(priceNote)}</b></div>
      ${secondaryPrice ? `<div class="secondary-price">${escapeHtml(secondaryPrice)}</div>` : ''}
      <a class="rail-cta" href="${escapeHtml(clickUrl)}">${escapeHtml(cta)}</a>
      <p class="rail-support">${escapeHtml(support)}</p>
      <div class="rail-court" aria-hidden="true"><img src="${visuals.court}" alt=""></div>
      <div class="rail-scan">
        <img src="${qrData}" alt="Scan to open ${escapeHtml(displayUrl)}">
        <div><b>${scanLabel}</b><span>${escapeHtml(displayUrl)}</span></div>
      </div>
    </aside>
  `
}

function comparison(lead, paid, why) {
  return `
    <header class="comparison">
      <h2><span>${escapeHtml(lead)}</span><strong>${escapeHtml(paid)}</strong></h2>
      <p>${escapeHtml(why)}</p>
    </header>
  `
}

function liveView(screenshotData, label, url, liveUrl, extraClass = '') {
  return `
    <figure class="live-view ${extraClass}">
      <div class="browser-chrome"><i></i><i></i><i></i><span>LIVE TENACEIQ PRODUCT VIEW</span></div>
      <a class="live-link" href="${escapeHtml(liveUrl)}">
        <img src="${screenshotData}" alt="${escapeHtml(label)}">
        <figcaption><span>${escapeHtml(label)}</span><b>${escapeHtml(url)} &nbsp; / &nbsp; captured Aug 12, 2026</b></figcaption>
      </a>
    </figure>
  `
}

function liveConnectedWorkspaces(items, label, liveUrl) {
  return `
    <figure class="live-view connected-workspaces">
      <div class="browser-chrome"><i></i><i></i><i></i><span>THREE LIVE TENACEIQ WORKSPACES. ONE CONNECTED PLAN.</span></div>
      <a class="live-link" href="${escapeHtml(liveUrl)}">
        <div class="workspace-grid">
          ${items.map((item, index) => `
            <article class="workspace-proof ${index === 0 ? 'workspace-primary' : ''}">
              <img src="${item.data}" alt="Live TenAceIQ ${escapeHtml(item.label)} view">
              <div><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.promise)}</span></div>
            </article>
          `).join('')}
        </div>
        <figcaption><span>${escapeHtml(label)}</span><b>3 LIVE VIEWS / AUG 12, 2026</b></figcaption>
      </a>
    </figure>
  `
}

function outcomeRows(outcomes, tierName) {
  const visuals = pageVisualSources[visualAssetKey(tierName)]
  return `
    <section class="outcome-rows">
      ${outcomes.map((outcome, index) => `
        <article>
          <div class="outcome-number">${String(index + 1).padStart(2, '0')}</div>
          <img class="outcome-icon" src="${visuals.icons[index]}" alt="">
          <div class="outcome-copy">
            <h3>${escapeHtml(outcome.title)}</h3>
            <p>${escapeHtml(outcome.benefit)}</p>
            <small><b>INCLUDED TOOLS:</b><span>${escapeHtml(outcome.tools)}</span></small>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function mainClose(close, name, price, priceNote, ctaLabel, displayUrl, clickUrl) {
  const visuals = pageVisualSources[visualAssetKey(name)]
  return `
    <a class="main-close" href="${escapeHtml(clickUrl)}">
      <span>${escapeHtml(close)}</span>
      <div class="close-offer"><img src="${visuals.arrow}" alt=""><strong>${escapeHtml(name.toUpperCase())} - ${escapeHtml(price)}</strong><b>${escapeHtml(priceNote)}</b></div>
      <small>${escapeHtml(ctaLabel)}<i></i>${escapeHtml(displayUrl)}</small>
    </a>
  `
}

function clubCarouselTier() {
  return {
    slug: 'club',
    name: 'Club',
    accent: '#5de279',
    railTitleTop: 'CONNECT THE CLUB.',
    railTitleAccent: 'MOVE EVERY ROLE.',
    comparePaid: 'CLUB CONNECTS THE WHOLE MEMBER EXPERIENCE.',
    core: 'Club connects players, coaches, programs, leagues, tournaments, schedules, and updates around the systems your club already uses.',
    why: 'You are paying for fewer spreadsheets, one source of truth, and a member experience that keeps every tennis role moving.',
    price: '$99',
    priceNote: '/ MONTH - UP TO 10 COACHES',
    secondaryPrice: '$199 / MONTH - UNLIMITED COACHES',
    cta: 'EXPLORE CLUB',
    support: 'Starter covers one location, up to 10 coaches/staff, and 150 player profiles. Unlimited removes those limits.',
    ctaUrl: 'https://www.tenaceiq.com/clubs',
    displayUrl: 'tenaceiq.com/clubs',
    screenshotLabel: 'LIVE VIEW: CLUB',
    screenshotUrl: 'tenaceiq.com/clubs',
    outcomes: [
      { title: 'ONE CLUB HOME', benefit: 'Make schedules, programs, and updates easy to find.', tools: 'Branded club home, portal, rosters, attendance, plans, and updates.' },
      { title: 'CONNECTED PROGRAMS', benefit: 'Keep players, coaches, teams, clinics, and camps in one context.', tools: 'People, programs, groups, teams, and connected role experiences.' },
      { title: 'COMPETITION INCLUDED', benefit: 'Run leagues and tournaments without rebuilding the operation elsewhere.', tools: 'Reusable competition setups, results, standings, rankings, and visibility.' },
    ],
  }
}

async function renderTierCarousel(browserHandle, tier, assets) {
  const proof = tier.liveProofType === 'connected-workspaces'
    ? carouselConnectedProof(assets.screenshotGallery)
    : `<div class="carousel-proof"><img src="${assets.screenshotData}" alt="Live ${escapeHtml(tier.name)} product view"></div>`
  const slideHtml = [
    carouselSlide(tier, 1, 'PROMISE', `
      <div class="carousel-kicker">${escapeHtml(tier.name.toUpperCase())}</div>
      <h1>${escapeHtml(tier.railTitleTop)}<strong>${escapeHtml(tier.railTitleAccent)}</strong></h1>
      <p class="carousel-lead">${escapeHtml(tier.core)}</p>
      <div class="carousel-payoff">${escapeHtml(tier.why)}</div>
    `),
    carouselSlide(tier, 2, 'PRODUCT PROOF', `
      <div class="carousel-kicker">THIS IS WHAT YOU UNLOCK</div>
      <h2>${escapeHtml(tier.screenshotLabel)}</h2>
      ${proof}
      <p class="carousel-proof-caption">Real TenAceIQ product view. Captured Aug 12, 2026.</p>
    `),
    carouselSlide(tier, 3, 'WHY IT PAYS', `
      <div class="carousel-kicker">WHY WOULD I PAY?</div>
      <h2>THREE JOBS. ONE CLEARER TENNIS WEEK.</h2>
      <div class="carousel-outcomes">${tier.outcomes.map((outcome, index) => `
        <article><b>0${index + 1}</b><div><h3>${escapeHtml(outcome.title)}</h3><p>${escapeHtml(outcome.benefit)}</p><small>${escapeHtml(outcome.tools)}</small></div></article>
      `).join('')}</div>
    `),
    carouselSlide(tier, 4, 'ACTION', `
      <div class="carousel-kicker">READY WHEN THE JOB IS REAL</div>
      <h2>${escapeHtml(tier.name.toUpperCase())}</h2>
      <div class="carousel-price"><strong>${escapeHtml(tier.price)}</strong><span>${escapeHtml(tier.priceNote)}</span></div>
      ${tier.secondaryPrice ? `<div class="carousel-secondary">${escapeHtml(tier.secondaryPrice)}</div>` : ''}
      <p class="carousel-support">${escapeHtml(tier.support)}</p>
      <div class="carousel-cta">${escapeHtml(tier.cta)}</div>
      <div class="carousel-scan"><img src="${assets.qrData}" alt="Scan to open ${escapeHtml(tier.displayUrl)}"><div><b>${tier.name === 'Free' ? 'SCAN TO START' : tier.name === 'Club' ? 'SCAN TO EXPLORE' : 'SCAN TO UNLOCK'}</b><span>${escapeHtml(tier.displayUrl)}</span></div></div>
    `),
  ]
  await renderCarouselSlides(browserHandle, tier.slug, slideHtml)
}

async function renderPricingCarousel(browserHandle, assets) {
  const pricingTier = { slug: 'pricing', name: 'Pricing', accent: '#9be11d' }
  const slideHtml = [
    carouselSlide(pricingTier, 1, 'PROMISE', `<div class="carousel-kicker">TENACEIQ PRICING</div><h1>START FREE.<strong>PAY FOR THE JOB YOU NEED.</strong></h1><p class="carousel-lead">Your game, your players, your team, your season, or your whole operation.</p><div class="carousel-payoff">Upgrade only when a role-specific tool removes real tennis friction.</div>`),
    carouselSlide(pricingTier, 2, 'CHOOSE', `<div class="carousel-kicker">INDIVIDUAL ROLE PLANS</div><h2>CHOOSE THE WEEKLY JOB.</h2><div class="carousel-price-grid">${pricingRows.map(([name, price, job]) => `<article><b>${escapeHtml(name)}</b><strong>${escapeHtml(price)}</strong><span>${escapeHtml(job)}</span></article>`).join('')}</div>`),
    carouselSlide(pricingTier, 3, 'ORGANIZATION', `<div class="carousel-kicker">CLUB PLANS</div><h2>CONNECT THE WHOLE MEMBER EXPERIENCE.</h2><div class="carousel-club-plans"><article><b>STARTER</b><strong>$99/mo</strong><p>One location - Up to 10 coaches or staff - Up to 150 player profiles.</p></article><article><b>UNLIMITED</b><strong>$199/mo</strong><p>All locations - Unlimited coaches, staff, and player profiles.</p></article></div><div class="carousel-payoff">Same complete toolset. Choose Starter for a focused launch or Unlimited for organization-wide scale.</div>`),
    carouselSlide(pricingTier, 4, 'ACTION', `<div class="carousel-kicker">NOT SURE YET?</div><h2>START WITH FREE.</h2><p class="carousel-support">Explore players, teams, leagues, rankings, and public tennis intelligence. Choose a paid role only when you know the job you need solved.</p><div class="carousel-cta">FIND YOUR PLAN</div><div class="carousel-scan"><img src="${assets.qrData}" alt="Scan to open TenAceIQ pricing"><div><b>SCAN TO EXPLORE</b><span>tenaceiq.com/pricing</span></div></div>`),
  ]
  await renderCarouselSlides(browserHandle, 'pricing', slideHtml)
}

async function renderTierStory(browserHandle, tier, assets) {
  const storyQrData = await QRCode.toDataURL(socialTrackingUrl(tier.ctaUrl, 'story_qr', `${tier.slug}_story`), {
    errorCorrectionLevel: 'M', margin: 1, width: 220, color: { dark: '#071426', light: '#ffffff' },
  })
  const proof = tier.liveProofType === 'connected-workspaces'
    ? carouselConnectedProof(assets.screenshotGallery)
    : `<div class="story-proof"><img src="${assets.screenshotData}" alt="Live ${escapeHtml(tier.name)} product view"></div>`
  const outcome = tier.outcomes[0]
  const scanLabel = tier.name === 'Free' ? 'SCAN TO START' : tier.name === 'Club' ? 'SCAN TO EXPLORE' : 'SCAN TO UNLOCK'
  const content = `
    <main class="story-slide" style="--accent:${escapeHtml(tier.accent)}">
      ${storyHeader(tier.name)}
      <section class="story-copy">
        <div class="story-kicker">${escapeHtml(tier.name.toUpperCase())}</div>
        <h1>${escapeHtml(tier.railTitleTop)}<strong>${escapeHtml(tier.railTitleAccent)}</strong></h1>
        <p>${escapeHtml(tier.why)}</p>
      </section>
      ${proof}
      <section class="story-benefit"><b>${escapeHtml(outcome.title)}</b><span>${escapeHtml(outcome.benefit)}</span></section>
      <section class="story-offer">
        <div class="story-price"><strong>${escapeHtml(tier.price)}</strong><span>${escapeHtml(tier.priceNote)}</span></div>
        ${tier.secondaryPrice ? `<div class="story-secondary">${escapeHtml(tier.secondaryPrice)}</div>` : ''}
        <div class="story-action"><div><b>${escapeHtml(tier.cta)}</b><span>${escapeHtml(tier.displayUrl)}</span></div><img src="${storyQrData}" alt="${scanLabel}"></div>
      </section>
      <footer><span>MORE TENNIS. LESS CHAOS.</span><b>${scanLabel}</b></footer>
    </main>`
  await renderStory(browserHandle, tier.slug, content)
}

async function renderPricingStory(browserHandle) {
  const tier = { name: 'Pricing', accent: '#9be11d' }
  const storyQrData = await QRCode.toDataURL(socialTrackingUrl('https://www.tenaceiq.com/pricing', 'story_qr', 'pricing_story'), {
    errorCorrectionLevel: 'M', margin: 1, width: 220, color: { dark: '#071426', light: '#ffffff' },
  })
  const content = `
    <main class="story-slide story-pricing" style="--accent:${tier.accent}">
      ${storyHeader(tier.name)}
      <section class="story-copy">
        <div class="story-kicker">TENACEIQ PRICING</div>
        <h1>START FREE.<strong>PAY FOR THE JOB YOU NEED.</strong></h1>
        <p>Upgrade only when a role-specific tool removes real tennis friction.</p>
      </section>
      <section class="story-plan-grid">
        ${pricingRows.map(([name, price, job]) => `<article><b>${escapeHtml(name)}</b><strong>${escapeHtml(price)}</strong><span>${escapeHtml(job)}</span></article>`).join('')}
      </section>
      <section class="story-action pricing-action"><div><b>FIND YOUR PLAN</b><span>tenaceiq.com/pricing</span></div><img src="${storyQrData}" alt="Scan to explore TenAceIQ pricing"></section>
      <footer><span>MORE TENNIS. LESS CHAOS.</span><b>SCAN TO EXPLORE</b></footer>
    </main>`
  await renderStory(browserHandle, 'pricing', content)
}

function storyHeader(name) {
  const visuals = pageVisualSources[visualAssetKey(name)]
  return `<header><img src="${visuals.logo}" alt="TenAceIQ"><span>MORE TENNIS.<br>LESS CHAOS.</span></header>`
}

async function renderStory(browserHandle, slug, content) {
  const html = storyShell(content, `TenAceIQ ${slug} story`)
  const htmlPath = path.join(htmlDir, `tenaceiq-${slug}-story.html`)
  await writeFile(htmlPath, html, 'utf8')
  const page = await browserHandle.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(`file:///${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' })
  await waitForImages(page)
  const pngPath = path.join(storyImageDir, `tenaceiq-${slug}-story.png`)
  await page.screenshot({ path: pngPath, type: 'png', fullPage: false })
  await page.screenshot({ path: path.join(storyImageDir, `tenaceiq-${slug}-story.jpg`), type: 'jpeg', quality: 90, fullPage: false })
  await page.close()
}

function carouselConnectedProof(items) {
  return `<div class="carousel-connected">${items.map((item) => `<article><img src="${item.data}" alt="${escapeHtml(item.label)}"><div><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.promise)}</span></div></article>`).join('')}</div>`
}

function carouselSlide(tier, number, label, content) {
  const visuals = pageVisualSources[visualAssetKey(tier.name)]
  return `<main class="carousel-slide" style="--accent:${escapeHtml(tier.accent)}"><header><img src="${visuals.logo}" alt="TenAceIQ"><div><b>${String(number).padStart(2, '0')} / 04</b><span>${escapeHtml(label)}</span></div></header><section>${content}</section><footer><span>MORE TENNIS. LESS CHAOS.</span><b>${escapeHtml(tier.name.toUpperCase())}</b></footer></main>`
}

async function renderCarouselSlides(browserHandle, slug, slides) {
  const targetDir = path.join(carouselImageDir, slug)
  await mkdir(targetDir, { recursive: true })
  for (let index = 0; index < slides.length; index += 1) {
    const html = carouselShell(slides[index], `TenAceIQ ${slug} carousel slide ${index + 1}`)
    const htmlPath = path.join(htmlDir, `tenaceiq-${slug}-carousel-${index + 1}.html`)
    await writeFile(htmlPath, html, 'utf8')
    const page = await browserHandle.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
    await page.goto(`file:///${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' })
    await waitForImages(page)
    await page.screenshot({ path: path.join(targetDir, `tenaceiq-${slug}-carousel-${index + 1}.png`), type: 'png', fullPage: false })
    await page.screenshot({ path: path.join(targetDir, `tenaceiq-${slug}-carousel-${index + 1}.jpg`), type: 'jpeg', quality: 90, fullPage: false })
    await page.close()
  }
}

async function renderPdf(browserHandle, fileStem, html) {
  const htmlPath = path.join(htmlDir, `${fileStem}.html`)
  const pdfPath = path.join(outputDir, `${fileStem}.pdf`)
  await writeFile(htmlPath, html, 'utf8')
  const page = await browserHandle.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1 })
  await page.goto(`file:///${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' })
  await waitForImages(page)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({
    path: pdfPath,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  await page.close()
}

async function renderDigitalImages(browserHandle, fileStem, html) {
  const htmlPath = path.join(htmlDir, `${fileStem}.html`)
  await writeFile(htmlPath, html, 'utf8')
  const page = await browserHandle.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 })
  await page.goto(`file:///${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' })
  await waitForImages(page)
  const pngPath = path.join(fullPageImageDir, `${fileStem}.png`)
  const jpgPath = path.join(fullPageImageDir, `${fileStem}.jpg`)
  await page.screenshot({ path: pngPath, type: 'png', fullPage: false })
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 88, fullPage: false })
  await page.close()

  const input = sharp(pngPath)
  await input.clone().resize(1080, 1350, { fit: 'contain', background: '#071426' }).png({ compressionLevel: 9 }).toFile(path.join(socialImageDir, `${fileStem}-social.png`))
  await input.clone().resize(1080, 1350, { fit: 'contain', background: '#071426' }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(socialImageDir, `${fileStem}-social.jpg`))
}

async function renderRasterBook(browserHandle, entries) {
  const pages = []
  for (const entry of entries) {
    const imageData = await dataUri(path.join(fullPageImageDir, `${entry.stem}.png`), 'image/png')
    pages.push(`
      <section class="book-page">
        <img src="${imageData}" alt="${escapeHtml(entry.stem)}">
        <a class="book-live-link" href="${escapeHtml(entry.liveUrl)}" aria-label="Open live TenAceIQ view"></a>
        <a class="book-cta-link" href="${escapeHtml(entry.clickUrl)}" aria-label="Open TenAceIQ plan"></a>
      </section>
    `)
  }
  const html = `<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><style>
      @page { size: Letter; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 8.5in; }
      .book-page { position: relative; width: 8.5in; height: 11in; overflow: hidden; page-break-after: always; }
      .book-page:last-child { page-break-after: auto; }
      .book-page > img { display: block; width: 8.5in; height: 11in; }
      .book-live-link, .book-cta-link { position: absolute; display: block; }
      .book-live-link { left: 3.24in; right: .20in; top: 1.68in; height: 3.38in; }
      .book-cta-link { left: 3.24in; right: .20in; top: 9.74in; height: 1.12in; }
    </style></head><body>${pages.join('')}</body></html>`
  await renderPdf(browserHandle, 'tenaceiq-launch-collateral-book', html)
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => undefined)))
  })
}

async function dataUri(filePath, mimeType) {
  const bytes = await readFile(filePath)
  return `data:${mimeType};base64,${bytes.toString('base64')}`
}

function trackingUrl(url, medium, content) {
  const tracked = new URL(url)
  tracked.searchParams.set('utm_source', 'tenaceiq_collateral')
  tracked.searchParams.set('utm_medium', medium)
  tracked.searchParams.set('utm_campaign', 'launch_2026')
  tracked.searchParams.set('utm_content', content)
  return tracked.toString()
}

function socialTrackingUrl(url, medium, content) {
  const tracked = new URL(url)
  tracked.searchParams.set('utm_source', 'tenaceiq_social')
  tracked.searchParams.set('utm_medium', medium)
  tracked.searchParams.set('utm_campaign', 'launch_2026')
  tracked.searchParams.set('utm_content', content)
  return tracked.toString()
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function visualAssetKey(value) {
  return String(value ?? '').toLowerCase().replaceAll(' ', '-').replaceAll('_', '-')
}

function storyShell(content, title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #071426; background: #f7f8f5; }
    .story-slide { position: relative; width: 1080px; height: 1920px; overflow: hidden; padding: 70px 64px 95px; background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 17%, transparent), transparent 520px), #f7f8f5; }
    .story-slide:after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 22px; background: var(--accent); }
    header { height: 130px; padding: 19px 28px; display: flex; align-items: center; justify-content: space-between; background: #071426; border-radius: 28px; }
    header img { width: 360px; height: 90px; object-fit: contain; object-position: left center; }
    header span { color: #fff; text-align: right; font-size: 19px; line-height: 1.25; font-weight: 950; letter-spacing: .14em; }
    .story-copy { padding-top: 60px; }
    .story-kicker { color: color-mix(in srgb, var(--accent) 78%, #294608 22%); font-size: 25px; font-weight: 950; letter-spacing: .19em; }
    h1 { margin: 22px 0 0; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 94px; line-height: .91; letter-spacing: .004em; text-transform: uppercase; }
    h1 strong { display: block; color: var(--accent); }
    .story-copy p { margin: 35px 0 0; padding-top: 28px; border-top: 5px solid var(--accent); font-size: 30px; line-height: 1.3; font-weight: 800; }
    .story-proof { height: 510px; margin-top: 42px; overflow: hidden; background: #071426; border: 8px solid #071426; outline: 5px solid var(--accent); border-radius: 25px; box-shadow: 0 25px 55px rgba(7,20,38,.2); }
    .story-proof img { width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .story-slide > .carousel-connected { height: 510px; margin-top: 42px; }
    .story-slide > .carousel-connected article { border-color: var(--accent); }
    .story-slide > .carousel-connected div { height: 58px; }
    .story-slide > .carousel-connected img { height: calc(100% - 58px); }
    .story-slide > .carousel-connected b { font-size: 18px; }
    .story-slide > .carousel-connected span { font-size: 15px; }
    .story-benefit { margin-top: 38px; padding: 26px 30px; display: grid; gap: 8px; background: #071426; color: #fff; border-left: 11px solid var(--accent); border-radius: 17px; }
    .story-benefit b { color: var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 34px; letter-spacing: .04em; }
    .story-benefit span { font-size: 23px; line-height: 1.25; font-weight: 700; }
    .story-offer { margin-top: 36px; }
    .story-price { display: flex; align-items: baseline; gap: 18px; }
    .story-price strong { color: var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 115px; line-height: .86; }
    .story-price span { max-width: 270px; font-size: 28px; font-weight: 950; }
    .story-secondary { margin-top: 10px; font-size: 30px; font-weight: 950; }
    .story-action { position: absolute; left: 64px; right: 64px; bottom: 142px; height: 190px; padding: 20px 24px 20px 34px; display: flex; align-items: center; justify-content: space-between; background: var(--accent); border-radius: 24px; }
    .story-action div { min-width: 0; }
    .story-action b { display: block; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 49px; letter-spacing: .045em; }
    .story-action span { display: block; margin-top: 8px; font-size: 19px; font-weight: 850; overflow-wrap: anywhere; }
    .story-action img { width: 150px; height: 150px; padding: 8px; background: #fff; border: 7px solid #071426; border-radius: 16px; }
    footer { position: absolute; left: 64px; right: 64px; bottom: 58px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 950; letter-spacing: .13em; }
    footer b { color: color-mix(in srgb, var(--accent) 76%, #284805 24%); }
    .story-pricing .story-copy { padding-top: 54px; }
    .story-pricing h1 { font-size: 88px; }
    .story-plan-grid { margin-top: 42px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .story-plan-grid article { min-height: 175px; padding: 25px 26px; display: grid; grid-template-columns: 1fr auto; gap: 11px 18px; background: #fff; border-left: 10px solid var(--accent); border-radius: 18px; box-shadow: 0 14px 30px rgba(7,20,38,.09); }
    .story-plan-grid b { font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 36px; }
    .story-plan-grid strong { color: #527e0b; font-size: 24px; }
    .story-plan-grid span { grid-column: 1 / -1; color: #33455a; font-size: 21px; line-height: 1.2; font-weight: 750; }
    .pricing-action { bottom: 142px; }
    .carousel-connected { display: grid; grid-template-columns: 1.15fr 1fr; grid-template-rows: 1fr 1fr; gap: 13px; }
    .carousel-connected article { overflow: hidden; display: flex; flex-direction: column; background: #071426; border: 4px solid var(--accent); border-radius: 17px; }
    .carousel-connected article:first-child { grid-row: 1 / span 2; }
    .carousel-connected img { width: 100%; object-fit: contain; object-position: center; }
    .carousel-connected div { padding: 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 9px; background: #101f34; }
    .carousel-connected b { color: var(--accent); }
    .carousel-connected span { color: #fff; font-weight: 800; }
  </style></head><body>${content}</body></html>`
}

function carouselShell(content, title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1080px; height: 1350px; overflow: hidden; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #071426; background: #f7f8f5; }
    .carousel-slide { position: relative; width: 1080px; height: 1350px; overflow: hidden; padding: 52px 58px 56px; background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 420px), #f7f8f5; }
    .carousel-slide:after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 15px; background: var(--accent); }
    header { height: 112px; display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: #071426; border-radius: 24px; }
    header img { width: 330px; height: 78px; object-fit: contain; object-position: left center; }
    header div { display: flex; align-items: center; gap: 18px; }
    header b { color: var(--accent); font-size: 28px; letter-spacing: .08em; }
    header span { color: #fff; font-size: 19px; font-weight: 900; letter-spacing: .12em; }
    section { height: 1110px; padding-top: 55px; }
    .carousel-kicker { color: color-mix(in srgb, var(--accent) 80%, #294608 20%); font-size: 24px; font-weight: 950; letter-spacing: .18em; }
    h1, h2, h3 { font-family: Impact, "Arial Narrow", Arial, sans-serif; text-transform: uppercase; }
    h1 { margin: 22px 0 0; max-width: 940px; font-size: 102px; line-height: .92; letter-spacing: .005em; }
    h1 strong { display: block; color: var(--accent); }
    h2 { margin: 18px 0 30px; font-size: 65px; line-height: .96; }
    .carousel-lead { margin: 48px 0 0; padding-top: 34px; border-top: 5px solid var(--accent); max-width: 920px; color: #16263a; font-size: 35px; line-height: 1.3; font-weight: 750; }
    .carousel-payoff { margin-top: 45px; padding: 34px 38px; background: #071426; color: #fff; border-left: 12px solid var(--accent); border-radius: 18px; font-size: 31px; line-height: 1.3; font-weight: 800; }
    .carousel-proof { height: 700px; overflow: hidden; background: #071426; border: 8px solid #071426; outline: 5px solid var(--accent); border-radius: 25px; box-shadow: 0 28px 60px rgba(7,20,38,.22); }
    .carousel-proof img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .carousel-proof-caption { margin: 32px 0 0; font-size: 25px; font-weight: 850; color: #314358; }
    .carousel-connected { height: 720px; display: grid; grid-template-columns: 1.15fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; }
    .carousel-connected article { overflow: hidden; display: flex; flex-direction: column; background: #071426; border: 4px solid var(--accent); border-radius: 20px; }
    .carousel-connected article:first-child { grid-row: 1 / span 2; }
    .carousel-connected img { width: 100%; height: calc(100% - 70px); object-fit: contain; object-position: center; }
    .carousel-connected div { height: 70px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #101f34; }
    .carousel-connected b { color: var(--accent); font-size: 22px; }
    .carousel-connected span { color: #fff; font-size: 18px; font-weight: 800; }
    .carousel-outcomes { display: grid; gap: 24px; }
    .carousel-outcomes article { min-height: 235px; display: grid; grid-template-columns: 145px 1fr; gap: 28px; padding: 28px 32px; align-items: center; background: #fff; border: 3px solid color-mix(in srgb, var(--accent) 55%, #c8d0d8 45%); border-left: 12px solid var(--accent); border-radius: 20px; box-shadow: 0 15px 35px rgba(7,20,38,.08); }
    .carousel-outcomes article > b { color: var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 92px; }
    .carousel-outcomes h3 { margin: 0; font-size: 37px; line-height: 1; }
    .carousel-outcomes p { margin: 12px 0 9px; font-size: 25px; line-height: 1.18; font-weight: 750; }
    .carousel-outcomes small { color: #526277; font-size: 18px; line-height: 1.25; }
    .carousel-price { margin-top: 52px; display: flex; align-items: baseline; gap: 22px; }
    .carousel-price strong { color: var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 170px; line-height: .9; }
    .carousel-price span { max-width: 260px; font-size: 35px; font-weight: 950; }
    .carousel-secondary { margin-top: 20px; color: #071426; font-size: 42px; font-weight: 950; }
    .carousel-support { margin: 55px 0 0; max-width: 880px; font-size: 34px; line-height: 1.32; font-weight: 750; }
    .carousel-cta { margin-top: 45px; width: 600px; padding: 24px 28px; border-radius: 16px; color: #071426; background: var(--accent); text-align: center; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 50px; letter-spacing: .05em; }
    .carousel-scan { position: absolute; right: 70px; bottom: 100px; width: 300px; display: flex; flex-direction: column; align-items: center; }
    .carousel-scan img { width: 250px; height: 250px; padding: 12px; background: #fff; border: 10px solid #071426; outline: 7px solid var(--accent); border-radius: 22px; }
    .carousel-scan div { margin-top: 15px; width: 100%; padding: 14px; text-align: center; background: #071426; border-radius: 10px; }
    .carousel-scan b { display: block; color: var(--accent); font-size: 21px; letter-spacing: .08em; }
    .carousel-scan span { display: block; margin-top: 5px; color: #fff; font-size: 16px; overflow-wrap: anywhere; }
    .carousel-price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
    .carousel-price-grid article { position: relative; min-height: 205px; padding: 28px 30px; background: #fff; border-left: 10px solid var(--accent); border-radius: 18px; box-shadow: 0 16px 35px rgba(7,20,38,.09); }
    .carousel-price-grid b { display: block; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 39px; }
    .carousel-price-grid strong { position: absolute; top: 30px; right: 30px; color: #527e0b; font-size: 27px; }
    .carousel-price-grid span { display: block; margin-top: 32px; color: #33455a; font-size: 23px; line-height: 1.2; font-weight: 700; }
    .carousel-club-plans { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .carousel-club-plans article { min-height: 420px; padding: 44px 38px; background: #071426; color: #fff; border-top: 14px solid var(--accent); border-radius: 22px; }
    .carousel-club-plans b { display: block; color: var(--accent); font-size: 28px; letter-spacing: .12em; }
    .carousel-club-plans strong { display: block; margin-top: 35px; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 82px; }
    .carousel-club-plans p { margin: 35px 0 0; font-size: 25px; line-height: 1.35; font-weight: 700; }
    footer { position: absolute; left: 58px; right: 58px; bottom: 42px; display: flex; justify-content: space-between; color: #071426; font-size: 17px; font-weight: 950; letter-spacing: .12em; }
    footer b { color: color-mix(in srgb, var(--accent) 76%, #284805 24%); }
  </style></head><body>${content}</body></html>`
}

function shell(content, title, description) {
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="author" content="TenAceIQ">
    <meta name="description" content="${escapeHtml(description)}">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: Letter; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 8.5in; min-height: 11in; }
      body { font-family: "Segoe UI", Arial, sans-serif; background: #071426; color: #071426; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { position: relative; width: 8.5in; height: 11in; overflow: hidden; display: grid; grid-template-columns: 3.04in 1fr; background: #f7f8f5; }
      .rail { position: relative; min-width: 0; height: 11in; padding: .32in .30in .28in; overflow: hidden; background: #071426; color: #fff; }
      .rail:after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: var(--accent); }
      .brand-logo { position: relative; z-index: 3; display: block; width: 2.43in; height: auto; max-height: .78in; object-fit: contain; object-position: left center; }
      .rail-tier { position: relative; z-index: 3; margin-top: .29in; color: var(--accent); font: 900 12px/1 Arial, sans-serif; letter-spacing: .25em; text-transform: uppercase; }
      .rail h1 { position: relative; z-index: 3; margin: .14in 0 0; padding-bottom: .16in; border-bottom: 2px solid var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 55px; line-height: .92; letter-spacing: .003em; text-transform: uppercase; }
      .rail h1 span, .rail h1 em { display: block; font-style: normal; }
      .rail h1 em { color: var(--accent); }
      .tier-coach .rail h1 { font-size: 49px; }
      .tier-captain .rail h1 { font-size: 47px; }
      .tier-full-court .rail h1 { font-size: 47px; }
      .tier-pricing .rail h1 { font-size: 48px; }
      .tier-club .rail h1 { font-size: 50px; }
      .tier-free .rail h1 { font-size: 52px; }
      .rail-core { position: relative; z-index: 3; margin: 0; padding: .14in 0 .16in; border-bottom: 1px solid var(--accent); font-size: 14px; line-height: 1.35; font-weight: 650; color: #f6f8fb; }
      .rail-core strong { color: var(--accent); }
      .rail-price { position: relative; z-index: 3; margin-top: .17in; display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 7px; }
      .rail-price small { width: 100%; margin-bottom: 3px; color: #fff; font-size: 11px; font-weight: 900; letter-spacing: .10em; }
      .rail-price strong { color: var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 58px; line-height: .92; letter-spacing: .015em; }
      .rail-price b { color: #fff; font-size: 18px; font-weight: 900; }
      .tier-full-court .rail-price strong { font-size: 52px; }
      .tier-full-court .rail-price b { font-size: 16px; }
      .secondary-price { position: relative; z-index: 3; margin-top: 5px; color: #eef3f8; font-size: 11px; font-weight: 900; letter-spacing: .04em; }
      .rail-cta { position: relative; z-index: 3; display: block; margin-top: .14in; padding: .11in .10in; background: var(--accent); color: #071426; text-align: center; text-decoration: none; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 22px; letter-spacing: .06em; border-radius: 6px; }
      .rail-support { position: relative; z-index: 3; margin: .12in 0 0; max-width: 2.25in; color: #f2f5f8; font-size: 13px; line-height: 1.3; font-weight: 650; }
      .rail-court { position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; height: 2.65in; overflow: hidden; clip-path: polygon(0 34%, 100% 0, 100% 100%, 0 100%); }
      .rail-court img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 66%; }
      .rail-scan { position: absolute; z-index: 4; right: .24in; bottom: .24in; width: 1.25in; display: flex; flex-direction: column; align-items: center; gap: 5px; }
      .rail-scan img { width: 1.08in; height: 1.08in; padding: 5px; background: #fff; border: 5px solid #071426; outline: 3px solid var(--accent); border-radius: 9px; }
      .rail-scan div { max-width: 1.25in; padding: 4px 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #071426; }
      .rail-scan b { color: var(--accent); font-size: 8px; letter-spacing: .10em; }
      .rail-scan span { color: #fff; font-size: 6.7px; line-height: 1.15; text-align: center; overflow-wrap: anywhere; }
      .main-plane { position: relative; height: 11in; min-width: 0; padding: .25in .20in .14in .20in; background: #f7f8f5; }
      .comparison { min-height: 1.43in; padding-bottom: .10in; }
      .comparison h2 { margin: 0; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 32px; line-height: .98; letter-spacing: .01em; text-transform: uppercase; }
      .comparison h2 span, .comparison h2 strong { display: block; }
      .comparison h2 strong { color: color-mix(in srgb, var(--accent) 78%, #284805 22%); }
      .comparison p { margin: .09in 0 0; padding-top: .07in; border-top: 2px solid var(--accent); color: #17263b; font-size: 15px; line-height: 1.25; font-weight: 500; }
      .live-view { margin: 0; height: 3.38in; overflow: hidden; background: #071426; border: 2px solid #071426; border-radius: 15px; box-shadow: 0 8px 18px rgba(7,20,38,.16); }
      .browser-chrome { height: .25in; display: flex; align-items: center; gap: 5px; padding: 0 .10in; background: #101f34; }
      .browser-chrome i { width: 6px; height: 6px; border-radius: 50%; background: #52677f; }
      .browser-chrome i:nth-child(3) { background: var(--accent); }
      .browser-chrome span { margin-left: auto; color: #b9c7d6; font-size: 7px; font-weight: 900; letter-spacing: .14em; }
      .live-link { display: block; height: calc(100% - .25in); color: inherit; text-decoration: none; }
      .live-link > img { display: block; width: 100%; height: calc(100% - .31in); object-fit: cover; object-position: center center; }
      .workspace-grid { height: calc(100% - .31in); padding: 6px; display: grid; grid-template-columns: 1.16fr 1fr; grid-template-rows: 1fr 1fr; gap: 6px; background: linear-gradient(135deg, #071426 0%, #102746 100%); }
      .workspace-proof { min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: center; background: #0a1d35; border: 1px solid color-mix(in srgb, var(--accent) 52%, #52677f 48%); border-radius: 7px; }
      .workspace-primary { grid-row: 1 / span 2; }
      .workspace-proof img { display: block; width: 100%; height: calc(100% - .27in); object-fit: cover; object-position: top center; border-bottom: 1px solid rgba(255,255,255,.12); }
      .workspace-proof div { padding: 5px 7px 6px; display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
      .workspace-proof b { color: var(--accent); font-size: 8px; letter-spacing: .08em; }
      .workspace-proof span { color: #eef3f8; font-size: 7px; font-weight: 800; white-space: nowrap; }
      .workspace-primary div { padding-top: 8px; padding-bottom: 8px; }
      .workspace-primary img { height: calc(100% - .35in); object-fit: contain; }
      .workspace-primary b { font-size: 10px; }
      .workspace-primary span { font-size: 8px; }
      .live-view figcaption { height: .31in; padding: 0 .12in; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #101f34; border-top: 1px solid rgba(255,255,255,.12); }
      .live-view figcaption span { color: var(--accent); font-size: 8px; font-weight: 900; letter-spacing: .10em; }
      .live-view figcaption b { color: #b9c7d6; font-size: 7.5px; white-space: nowrap; }
      .outcome-rows { margin-top: .10in; }
      .outcome-rows article { min-height: 1.35in; display: grid; grid-template-columns: .80in .72in 1fr; align-items: center; gap: .08in; border-bottom: 1px solid color-mix(in srgb, var(--accent) 68%, #8fa07c 32%); }
      .outcome-number { align-self: stretch; display: flex; align-items: center; justify-content: center; color: color-mix(in srgb, var(--accent) 84%, #456515 16%); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 64px; line-height: 1; text-align: center; border-right: 2px solid var(--accent); }
      .outcome-icon { display: block; width: .68in; height: .68in; object-fit: contain; mix-blend-mode: multiply; }
      .outcome-copy { min-width: 0; padding: .07in 0; }
      .outcome-copy h3 { margin: 0; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 18px; line-height: 1.02; letter-spacing: .01em; text-transform: uppercase; }
      .outcome-copy p { margin: 4px 0 5px; color: #1c2b3e; font-size: 11.5px; line-height: 1.17; font-weight: 500; }
      .outcome-copy small { display: block; color: #26384e; font-size: 9.6px; line-height: 1.18; }
      .outcome-copy small b { display: block; margin-bottom: 2px; color: color-mix(in srgb, var(--accent) 76%, #37540c 24%); letter-spacing: .06em; }
      .outcome-copy small span { display: block; }
      .main-close { position: absolute; left: .20in; right: .20in; bottom: .08in; min-height: 1.18in; padding: .07in 0 0; color: #071426; text-decoration: none; border-top: 2px solid var(--accent); display: block; }
      .main-close > span { position: relative; left: 0; display: block; width: 100%; margin: 0; padding: 0 0 3px; overflow: hidden; background: #f7f8f5; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 18px; line-height: 1.05; letter-spacing: .035em; white-space: nowrap; }
      .close-offer { display: flex; align-items: center; gap: 8px; margin-top: 2px; white-space: nowrap; }
      .close-offer img { width: .34in; height: .34in; object-fit: contain; mix-blend-mode: multiply; }
      .main-close strong { color: var(--accent); font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 31px; letter-spacing: .025em; }
      .main-close b { color: #071426; font-size: 13px; }
      .main-close small { display: flex; justify-content: center; align-items: center; gap: 10px; color: #071426; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 13px; letter-spacing: .02em; }
      .main-close small i { width: 1px; height: 16px; background: var(--accent); }
      .tier-coach .main-close > span, .tier-club .main-close > span, .tier-full-court .main-close > span { font-size: 15px; }
      .tier-full-court .main-close > span { padding-left: .18in; }
      .tier-club .main-close strong { font-size: 27px; }
      .pricing-plane .comparison { min-height: 1.40in; }
      .pricing-view { height: 2.62in; }
      .pricing-list { margin-top: .10in; display: grid; grid-template-columns: 1fr 1fr; column-gap: .14in; }
      .pricing-list article { position: relative; min-height: 1.20in; padding: .14in .08in .10in; border-bottom: 1px solid #aab8c5; border-left: 4px solid var(--accent); background: #eef2ec; }
      .pricing-list span { display: block; padding-right: .88in; font-family: Impact, "Arial Narrow", Arial, sans-serif; font-size: 19px; letter-spacing: .03em; text-transform: uppercase; }
      .pricing-list strong { position: absolute; top: .15in; right: .08in; color: #456f08; font-size: 13px; }
      .pricing-list p { margin: 5px 0 0; color: #26384e; font-size: 10px; line-height: 1.18; }
      .club-pricing-line { margin-top: .10in; padding: .12in .12in; min-height: .78in; background: #eaf6d7; display: grid; grid-template-columns: 1fr 1fr; gap: .14in; border-left: 4px solid var(--accent); }
      .club-pricing-line div { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
      .club-pricing-line b { color: #1e3106; font-size: 8.5px; letter-spacing: .08em; }
      .club-pricing-line strong { color: #456f08; font-size: 12px; }
      .club-pricing-line span { grid-column: 1 / -1; color: #45566b; font-size: 8px; }
    </style>
  </head>
  <body>${content}</body>
  </html>`
}
