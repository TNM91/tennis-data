import {scenarioFixture} from './captain-scenarios'
import {courtScoutFixture,courtId} from './captain-court-scout'
import type {OpponentScenarioContext} from '../../native-opponent-scenario-contract'
export function opponentScenarioFixture(){const own=scenarioFixture(),court=courtScoutFixture();own.lineup.scope=court.scope;own.lineup.match=court.match;own.lineup.plan.courts=own.lineup.plan.courts.filter(c=>c.slotType==='doubles');const opp:OpponentScenarioContext={...court,ratings:[{id:courtId(2),singles_dynamic_rating:4.3,doubles_dynamic_rating:4,overall_dynamic_rating:4.2},{id:courtId(3),singles_dynamic_rating:null,doubles_dynamic_rating:null,overall_dynamic_rating:4.4}]};return {own,opp}}
