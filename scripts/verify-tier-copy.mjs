import { readFile } from 'node:fs/promises'

const files = {
  productStory: 'lib/product-story.ts',
  pricingPlans: 'lib/pricing-plans.ts',
  accessModel: 'lib/access-model.ts',
  primaryNavAccess: 'lib/primary-nav-access.ts',
  tierInventory: 'docs/tier-inventory.md',
  platformQa: 'docs/platform-closeout-qa.md',
}

const expectedTiers = [
  { id: 'free', name: 'Free', modeKey: 'find' },
  { id: 'player_plus', name: 'Player', modeKey: 'you' },
  { id: 'coach', name: 'Coach', modeKey: 'coach' },
  { id: 'captain', name: 'Captain', modeKey: 'team' },
  { id: 'league', name: 'League', modeKey: 'league' },
  { id: 'full_court', name: 'Full-Court', modeKey: 'plans' },
]

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
  ),
)

const findings = []

for (const tier of expectedTiers) {
  expectContains(sources.productStory, `${tier.id}: {`, files.productStory, `${tier.id} membership tier`)
  expectContains(sources.productStory, `name: '${tier.name}'`, files.productStory, `${tier.name} tier name`)
  expectContains(sources.productStory, `'${tier.id}'`, files.productStory, `${tier.id} tier order/type`)
  expectContains(sources.pricingPlans, `id: '${tier.id}'`, files.pricingPlans, `${tier.id} pricing plan`)
  expectContains(sources.tierInventory, tier.name, files.tierInventory, `${tier.name} inventory row`)
  expectContains(sources.platformQa, tier.name, files.platformQa, `${tier.name} QA row`)
}

for (const tier of expectedTiers.filter((tier) => tier.id !== 'full_court')) {
  expectContains(sources.primaryNavAccess, `PRODUCT_MODE_LANGUAGE.${tier.modeKey}.route`, files.primaryNavAccess, `${tier.name} primary nav route`)
}

for (const planId of ['player_plus', 'coach', 'captain', 'league']) {
  expectContains(sources.primaryNavAccess, `return '${planId}'`, files.primaryNavAccess, `${planId} primary nav lock`)
  expectContains(sources.accessModel, `hasPlanAccess(activePlanIds, '${planId}')`, files.accessModel, `${planId} access capability`)
}

expectContains(sources.accessModel, "activePlanIds.includes('full_court')", files.accessModel, 'full_court access override')
expectContains(sources.accessModel, 'FULL_COURT_PRICE_LABEL', files.accessModel, 'full court price label')
expectContains(sources.pricingPlans, "badge: 'Full Suite'", files.pricingPlans, 'full court pricing badge')
expectContains(sources.productStory, 'Connected development workflows for coaches', files.productStory, 'coach principle')
expectContains(sources.productStory, 'League operations for coordinators and admins', files.productStory, 'league principle')

const pricingPlanIds = collectRegexMatches(sources.pricingPlans, /id: '([^']+)'/g)
const missingPricingPlans = expectedTiers.map((tier) => tier.id).filter((id) => !pricingPlanIds.includes(id))
if (missingPricingPlans.length) {
  findings.push({
    file: files.pricingPlans,
    check: 'pricing plan coverage',
    missing: missingPricingPlans,
  })
}

const orderMatch = sources.productStory.match(/MEMBERSHIP_TIER_ORDER:[^\n]+=\s*\[([^\]]+)\]/)
if (!orderMatch) {
  findings.push({ file: files.productStory, check: 'membership tier order', missing: ['MEMBERSHIP_TIER_ORDER'] })
} else {
  const orderIds = collectRegexMatches(orderMatch[1], /'([^']+)'/g)
  const expectedOrder = expectedTiers.map((tier) => tier.id)
  if (orderIds.join('|') !== expectedOrder.join('|')) {
    findings.push({
      file: files.productStory,
      check: 'membership tier order',
      expected: expectedOrder,
      actual: orderIds,
    })
  }
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  checkedTiers: expectedTiers.map((tier) => tier.id),
  checkedFiles: Object.values(files),
}, null, 2))

function expectContains(source, needle, file, check) {
  if (source.includes(needle)) return
  findings.push({ file, check, missing: [needle] })
}

function collectRegexMatches(source, regex) {
  return [...source.matchAll(regex)].map((match) => match[1])
}
