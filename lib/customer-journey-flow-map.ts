import type { PlatformCloseoutTierId, PlatformCustomerJourneyStage } from './platform-closeout-inventory'
import flowMaps from './customer-journey-flow-map.json'

export type CustomerJourneyFlowRisk = 'critical' | 'high' | 'medium'

export type CustomerJourneyFlowStep = {
  stage: PlatformCustomerJourneyStage
  action: string
  surface: string
  route: string
  productSignal: string
  evidence: string
}

export type CustomerJourneyFlowHandoff = {
  toTierId: PlatformCloseoutTierId
  label: string
  trigger: string
  proof: string
}

export type CustomerJourneyFlowMap = {
  id: string
  tierId: PlatformCloseoutTierId
  label: string
  persona: string
  painPoint: string
  accessRule: string
  entryRoute: string
  primaryFeatureIds: string[]
  steps: CustomerJourneyFlowStep[]
  handoffs: CustomerJourneyFlowHandoff[]
  testRisk: CustomerJourneyFlowRisk
}

export const CUSTOMER_JOURNEY_FLOW_MAPS = flowMaps as CustomerJourneyFlowMap[]

export function getCustomerJourneyFlowMap(id: string) {
  return CUSTOMER_JOURNEY_FLOW_MAPS.find((flow) => flow.id === id)
}

export function getCustomerJourneyFlowMapsForTier(tierId: PlatformCloseoutTierId) {
  return CUSTOMER_JOURNEY_FLOW_MAPS.filter((flow) => flow.tierId === tierId)
}

export function getCustomerJourneyFlowMapsForFeature(featureId: string) {
  return CUSTOMER_JOURNEY_FLOW_MAPS.filter((flow) => flow.primaryFeatureIds.includes(featureId))
}
