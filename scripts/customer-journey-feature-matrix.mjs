import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const processMapPath = 'docs/customer-journey-process-map.md'
const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')

const matrixStart = processMapSource.indexOf('## Feature Access And Pain Point Matrix')
const matrixEnd = processMapSource.indexOf('## Next Week Test Order')

if (matrixStart === -1 || matrixEnd === -1 || matrixEnd <= matrixStart) {
  console.error(`Could not find the feature matrix in ${processMapPath}.`)
  process.exit(1)
}

const matrixSource = processMapSource.slice(matrixStart, matrixEnd).trim()
const rows = matrixSource
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .slice(1)
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replaceAll('`', '')),
  )

console.log('TenAceIQ Tier Feature QA Matrix')
console.log('')
console.log(`Source: ${processMapPath}`)
console.log('Use this while testing each tier: feature, pain point, status, verification, and route.')
console.log('')

let activeTier = ''
for (const [tier, feature, stage, route, painPoint, status, verification] of rows) {
  if (tier !== activeTier) {
    activeTier = tier
    console.log(activeTier)
  }

  console.log(`- ${feature} (${stage})`)
  console.log(`  Route: ${route}`)
  console.log(`  Pain point: ${painPoint}`)
  console.log(`  Status: ${status}; verification: ${verification}`)
}

console.log('')
console.log('Closeout rule: a feature is not test-ready until the pain point is solved in the matching journey evidence.')
