import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const productStoryPath = 'lib/product-story.ts'
const source = readFileSync(join(process.cwd(), productStoryPath), 'utf8')
const paidLaunch = process.argv.includes('--paid')

function extractConstString(name) {
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*(?:\\r?\\n\\s*)?'([^']+)'`))
  if (!match) throw new Error(`Missing ${name} in ${productStoryPath}`)
  return match[1]
}

function extractObjectField(objectName, fieldName) {
  const objectStart = source.indexOf(`export const ${objectName}`)
  if (objectStart === -1) throw new Error(`Missing ${objectName} in ${productStoryPath}`)
  const objectEnd = source.indexOf('} as const', objectStart)
  const objectSource = source.slice(objectStart, objectEnd)
  const match = objectSource.match(new RegExp(`${fieldName}:\\s*(?:\\r?\\n\\s*)?'([^']+)'`))
  if (!match) throw new Error(`Missing ${objectName}.${fieldName} in ${productStoryPath}`)
  return match[1]
}

function readBalancedBlock(startMarker) {
  const markerIndex = source.indexOf(startMarker)
  if (markerIndex === -1) throw new Error(`Missing ${startMarker} in ${productStoryPath}`)

  const blockStart = source.indexOf('{', markerIndex)
  let depth = 0
  let inString = false

  for (let index = blockStart; index < source.length; index += 1) {
    const char = source[index]
    const previous = source[index - 1]

    if (char === "'" && previous !== '\\') inString = !inString
    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return source.slice(blockStart, index + 1)
  }

  throw new Error(`Unclosed block for ${startMarker}`)
}

function extractTier(tierId) {
  const block = readBalancedBlock(`  ${tierId}: {`)
  const field = (name) => {
    const match = block.match(new RegExp(`${name}:\\s*(?:\\r?\\n\\s*)?'([^']+)'`))
    if (!match) throw new Error(`Missing ${tierId}.${name} in ${productStoryPath}`)
    return match[1]
  }

  const valuePropsBlock = block.match(/valueProps:\s*\[([\s\S]*?)\]/)?.[1]
  if (!valuePropsBlock) throw new Error(`Missing ${tierId}.valueProps in ${productStoryPath}`)

  return {
    id: tierId,
    name: field('name'),
    promise: field('shortPromise'),
    audience: field('audience'),
    description: field('description'),
    valueProps: [...valuePropsBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]),
  }
}

const brand = {
  motto: extractConstString('PRODUCT_MOTTO'),
  northStar: extractConstString('PRODUCT_NORTH_STAR'),
  positioning: extractConstString('PLATFORM_POSITIONING'),
  mission: extractConstString('PLATFORM_MISSION'),
  coreLine: extractObjectField('PRODUCT_LANGUAGE_SYSTEM', 'coreLine'),
  productMission: extractObjectField('PRODUCT_LANGUAGE_SYSTEM', 'mission'),
}

const tiers = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court'].map(extractTier)

const tierNames = tiers.map((tier) => tier.name).join(', ')
const publicUrl = 'https://www.tenaceiq.com'

const announcementCopy = paidLaunch
  ? {
      websiteOrLinkedInHeadline: `TenAceIQ is ready: ${brand.motto}`,
      shortSocial:
        `${brand.motto} TenAceIQ is ready for players, coaches, captains, leagues, and tennis organizers who want clearer context and less coordination drag.`,
      longSocial:
        `${brand.northStar} Start free with public tennis context, then choose the role-based tools that support your game, team, players, league, or tournament.`,
      emailSubject: 'TenAceIQ is ready',
      emailPreview: brand.coreLine,
      emailBody: [
        'TenAceIQ is ready to share more broadly.',
        brand.positioning,
        'Start with public tennis context for free, then choose the role-based tools that fit how you play, improve, coach, captain, or run competition.',
        `Available tiers: ${tierNames}.`,
        `Start here: ${publicUrl}`,
      ],
    }

  : {
      websiteOrLinkedInHeadline: `Explore tennis with TenAceIQ: ${brand.motto}`,
      shortSocial:
        `${brand.motto} Explore players, teams, leagues, rankings, and tournaments for free with TenAceIQ.`,
      longSocial:
        `TenAceIQ is now open for free tennis exploration. Search players, teams, leagues, rankings, and tournaments in one place. Paid Player, Coach, Captain, League, and Full-Court tools are opening soon; join early access if you want to be first in line.`,
      emailSubject: 'Explore tennis with TenAceIQ',
      emailPreview: 'Search players, teams, leagues, rankings, and tournaments for free.',
      emailBody: [
        'TenAceIQ is now open for free tennis exploration.',
        'Search players, teams, leagues, rankings, and tournaments in one place, then use the context to make the next tennis decision clearer.',
        'Paid Player, Coach, Captain, League, and Full-Court tools are opening soon. You can join early access without entering payment information.',
        `Explore free: ${publicUrl}/explore`,
      ],
    }

const campaignAssets = {
  primaryCta: { label: 'Explore free', href: `${publicUrl}/explore` },
  secondaryCta: paidLaunch
    ? { label: 'See plans', href: `${publicUrl}/pricing` }
    : { label: 'Join early access', href: `${publicUrl}/pricing` },
  directInvite: paidLaunch
    ? `I am opening TenAceIQ to a small group of tennis players, captains, coaches, and organizers. Explore the public tennis map, choose the tools that fit your role, then tell me what would make your next tennis decision easier: ${publicUrl}`
    : `I am opening TenAceIQ to a small group of tennis players, captains, coaches, and organizers. Explore the public tennis map for free, then tell me what would make your next tennis decision easier: ${publicUrl}/explore`,
  feedbackPrompt:
    'What were you trying to do, where did you hesitate, and what would have made the next step obvious?',
  screenshotSequence: [
    { route: '/', proof: 'Clear role-based entry into Explore, Improve, Compete, Captain, Coaches, and Leagues.' },
    { route: '/explore', proof: 'Free tennis discovery starts with one obvious next action.' },
    { route: '/explore/players', proof: 'Player discovery and public tennis context.' },
    { route: '/explore/teams', proof: 'Team discovery without requiring a paid account.' },
    { route: '/explore/leagues', proof: 'League discovery and public competition context.' },
    {
      route: '/pricing',
      proof: paidLaunch
        ? 'Plans, prices, and role-based outcomes are clear before checkout.'
        : 'Paid tools are clearly marked as early access with no checkout pressure.',
    },
  ],
  captureGuardrail: paidLaunch
    ? 'Use signed-in role screenshots only after the matching authenticated QA fixtures pass.'
    : 'Use public/free screenshots now. Add signed-in Player, Coach, Captain, League, and Full-Court screenshots only after their authenticated QA fixtures pass.',
  authenticatedCapture: {
    status: 'Blocked until private QA fixture credentials are configured.',
    credentialContract: 'npm run qa:fixture-auth-smoke -- --env',
    smokeCommand: 'npm run qa:fixture-auth-smoke -- all',
    safety: 'Store QA emails and passwords only in .env.local or the shell. Never commit or paste them into launch materials.',
  },
}

const freeFirstReadyCaptions = {
  launch: [
    'TenAceIQ is open for free tennis exploration.',
    'Search players, teams, leagues, rankings, and tournaments in one place - then make the next tennis decision with clearer context.',
    `Explore free: ${publicUrl}/explore`,
  ],
  exploreStory: [
    'Explore tennis. Free.',
    'Players. Teams. Leagues. Rankings. Tournaments.',
    `Start here: ${publicUrl}/explore`,
  ],
  playerDiscovery: [
    'Looking up a player should not mean bouncing between tabs.',
    'Search the player directory, check public tennis context, and keep moving.',
    `Explore players free: ${publicUrl}/explore/players`,
  ],
  knowTheField: [
    'Before the next match, know the field.',
    'Search players, teams, leagues, and rankings in one place. Start with the public tennis context you need, free.',
    `${publicUrl}/explore`,
  ],
  matchPrepQuestion: [
    'What takes too long before your next match?',
    'Finding players? Checking a roster? Reading the league table? Comparing the field?',
    `Explore free: ${publicUrl}/explore`,
  ],
  startFree: [
    'Start free. Add the right tools when they help.',
    'Public tennis exploration is open now. Player, Coach, Captain, League, and Full-Court tools are opening soon.',
    `Explore now: ${publicUrl}/explore`,
    `Early access: ${publicUrl}/pricing`,
  ],
  roleToolsStory: [
    'Available now: free public tennis exploration.',
    'Opening soon: tools for players, coaches, captains, leagues, and organizers.',
    `Join early access: ${publicUrl}/pricing`,
  ],
  teamAndLeagueDiscovery: [
    'Find the team. Check the roster. Open the league table.',
    'TenAceIQ brings public tennis context together so the next step is easier to see.',
    `Explore free: ${publicUrl}/explore`,
  ],
  founderNote: [
    'I built TenAceIQ because tennis decisions are spread across too many pages, files, texts, and assumptions.',
    'The first step is simple: public tennis exploration is free. Search the field, find the context, and tell me where the next step still feels harder than it should.',
    `${publicUrl}/explore`,
  ],
  recapAndFeedback: [
    'Two weeks into opening TenAceIQ, the goal is still simple: less searching, less guessing, more tennis.',
    'Try one free search, then tell me: what were you trying to do, and where did you hesitate?',
    `${publicUrl}/explore`,
  ],
}

const freeFirstPublishingCalendar = [
  { day: 1, channel: 'LinkedIn, Facebook, Instagram', asset: 'feed-01-explore-tennis-free.png', action: 'Publish launch', caption: 'launch' },
  { day: 2, channel: 'Instagram and Facebook Stories', asset: 'story-01-explore-tennis-free.png', action: 'Share free-exploration Story', caption: 'exploreStory' },
  { day: 3, channel: 'LinkedIn, Facebook', asset: 'square-01-explore-tennis-free.png', action: 'Publish player discovery', caption: 'playerDiscovery' },
  { day: 4, channel: 'Direct outreach', asset: null, action: 'Send 10 personal invitations and ask the feedback prompt', caption: null },
  { day: 5, channel: 'LinkedIn, Facebook, Instagram', asset: 'feed-02-know-the-field.png', action: 'Publish product discovery', caption: 'knowTheField' },
  { day: 6, channel: 'Instagram and Facebook Stories', asset: 'story-02-know-the-field.png', action: 'Ask what takes too long before the next match', caption: 'matchPrepQuestion' },
  { day: 7, channel: 'Owner review', asset: null, action: 'Reply, group repeated friction, and run post-launch checks', caption: null },
  { day: 8, channel: 'LinkedIn, Facebook, Instagram', asset: 'feed-03-start-free.png', action: 'Publish free-now, roles-soon message', caption: 'startFree' },
  { day: 9, channel: 'LinkedIn, Facebook', asset: 'square-02-know-the-field.png', action: 'Publish team and league discovery', caption: 'teamAndLeagueDiscovery' },
  { day: 10, channel: 'Direct outreach', asset: null, action: 'Invite 10 captains, coaches, or organizers to early access', caption: null },
  { day: 11, channel: 'Instagram and Facebook Stories', asset: 'story-03-start-free.png', action: 'Share role-tools early-access Story', caption: 'roleToolsStory' },
  { day: 12, channel: 'LinkedIn', asset: 'square-03-start-free.png', action: 'Publish founder note', caption: 'founderNote' },
  { day: 13, channel: 'Email', asset: 'feed-01-explore-tennis-free.png', action: 'Send launch email to the approved list', caption: null },
  { day: 14, channel: 'LinkedIn, Facebook, Instagram', asset: 'feed-02-know-the-field.png', action: 'Publish recap and ask for feedback', caption: 'recapAndFeedback' },
]

const packet = {
  ok: true,
  generatedFrom: productStoryPath,
  launchMode: paidLaunch ? 'paid-launch' : 'free-first',
  audience: 'Owner review before broad public launch links are shared.',
  brand,
  announcementCopy,
  campaignAssets,
  publishingPlan: paidLaunch
    ? {
        status: 'Regenerate campaign captions after the controlled live purchase pass.',
      }
    : {
        cadence: 'Two weeks from the owner-selected launch day, with quiet days reserved for replies, direct invitations, feedback, and production checks.',
        assetFormats: ['1080 x 1350 feed', '1080 x 1080 square', '1080 x 1920 Story'],
        calendar: freeFirstPublishingCalendar,
        readyCaptions: freeFirstReadyCaptions,
      },
  tierTalkingPoints: tiers.map((tier) => ({
    tier: tier.name,
    availability: tier.id === 'free' ? 'Available now' : paidLaunch ? 'Available now' : 'Early access',
    promise: tier.promise,
    audience: tier.audience,
    description: tier.description,
    firstProofPoints: tier.valueProps.slice(0, 3),
  })),
  copyGuardrails: [
    'Keep copy tennis-specific and action-oriented.',
    'Position Free as public tennis context, not a watered-down paid workspace.',
    'Do not imply direct USTA API dependence; use Data Assist upload language when talking about data refreshes.',
    paidLaunch
      ? 'Use paid-upgrade language only after live checkout and the controlled purchase pass are verified.'
      : 'Say paid tools are opening soon and invite early access. Do not imply that checkout is available.',
  ],
  ownerReviewChecklist: [
    'Run npm run qa:go-no-go -- --live before broad public posting.',
    'Confirm public links point to https://www.tenaceiq.com.',
    paidLaunch
      ? 'Confirm Stripe live checkout, access activation, portal handoff, cancellation, and refund evidence before posting.'
      : 'Confirm paid tools are framed as early access and no public action opens Stripe checkout.',
    'After posting, run npm run qa:post-launch -- --live and watch Vercel Web Analytics plus Speed Insights.',
  ],
  launchChecks: [
    'npm run qa:announcement',
    'npm run qa:go-no-go -- --live',
    'npm run qa:post-launch -- --live',
    'npm run qa:observability -- --live',
    'npm run qa:prod-logs -- --since=30m',
  ],
}

console.log(JSON.stringify(packet, null, 2))
