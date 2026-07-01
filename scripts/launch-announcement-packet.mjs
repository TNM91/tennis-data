import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const productStoryPath = 'lib/product-story.ts'
const source = readFileSync(join(process.cwd(), productStoryPath), 'utf8')

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

const packet = {
  ok: true,
  generatedFrom: productStoryPath,
  audience: 'Owner review before broad public launch links are shared.',
  brand,
  announcementCopy: {
    websiteOrLinkedInHeadline: `TenAceIQ is ready: ${brand.motto}`,
    shortSocial:
      `${brand.motto} TenAceIQ is launch-ready for players, coaches, captains, leagues, and tennis organizers who want clearer context and less coordination drag.`,
    longSocial:
      `${brand.northStar} Start free with public tennis context, then unlock the right tools when you want support for your game, team, players, league, or tournament.`,
    emailSubject: 'TenAceIQ is ready for launch',
    emailPreview: brand.coreLine,
    emailBody: [
      'TenAceIQ is ready to share more broadly.',
      brand.positioning,
      'You can start by exploring public tennis context for free, then choose the role-based tools that fit how you play, improve, coach, captain, or run competition.',
      `Launch tiers: ${tierNames}.`,
      `Start here: ${publicUrl}`,
    ],
  },
  tierTalkingPoints: tiers.map((tier) => ({
    tier: tier.name,
    promise: tier.promise,
    audience: tier.audience,
    description: tier.description,
    firstProofPoints: tier.valueProps.slice(0, 3),
  })),
  copyGuardrails: [
    'Keep copy tennis-specific and action-oriented.',
    'Position Free as public tennis context, not a watered-down paid workspace.',
    'Do not imply direct USTA API dependence; use Data Assist upload language when talking about data refreshes.',
    'Keep Stripe paid-upgrade language out of broad launch copy until live mode is intentionally opened.',
  ],
  ownerReviewChecklist: [
    'Run npm run qa:go-no-go -- --live before broad public posting.',
    'Confirm public links point to https://www.tenaceiq.com.',
    'Confirm Stripe paid upgrades are still framed as deferred if live mode is not open.',
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
