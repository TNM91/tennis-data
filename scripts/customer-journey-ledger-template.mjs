import { customerJourneyDetails } from './customer-journey-qa-data.mjs'

const journeys = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  entryRoute: journey.entryRoute,
  accountFixture: journey.accountFixture,
}))

console.log('TenAceIQ Customer Journey Ledger Rows')
console.log('')
console.log('Paste these into docs/customer-journey-test-results.md under Result Ledger.')
console.log('')
console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')

for (const journey of journeys) {
  console.log(
    `|  |  |  | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  |  |`
  )
}

console.log('')
console.log('Use result values: pass, fail, blocked, needs-follow-up.')
console.log('Use severity values: p0, p1, p2, p3.')
