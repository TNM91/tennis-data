// lib/demoData.ts

export const demoPlayers = [
  { id: 'p1', name: 'John Smith', rating: 4.2 },
  { id: 'p2', name: 'Mike Johnson', rating: 4.0 },
  { id: 'p3', name: 'Chris Lee', rating: 3.9 },
  { id: 'p4', name: 'David Brown', rating: 4.3 },
  { id: 'p5', name: 'Ryan Davis', rating: 3.8 },
  { id: 'p6', name: 'Alex Miller', rating: 4.1 },
  { id: 'p7', name: 'Matt Wilson', rating: 3.7 },
  { id: 'p8', name: 'Kevin Moore', rating: 3.9 },
]

export const demoTeam = {
  name: 'St. Louis Aces',
  league: 'USTA 4.0',
  flight: 'A',
}

export const demoMatch = {
  id: 'm1',
  match_date: new Date().toISOString(),
  home_team: 'St. Louis Aces',
  away_team: 'Chesterfield Crushers',
  league_name: 'USTA 4.0',
  flight: 'A',
}

export const demoScenario = {
  id: 's1',
  scenario_name: 'Balanced Lineup',
  team_name: 'St. Louis Aces',
  opponent_team: 'Chesterfield Crushers',
  league_name: 'USTA 4.0',
  flight: 'A',
  match_date: new Date().toISOString(),
  slots_json: [
    { label: 'Singles 1', players: ['John Smith'] },
    { label: 'Singles 2', players: ['Mike Johnson'] },
    { label: 'Doubles 1', players: ['Chris Lee', 'David Brown'] },
    { label: 'Doubles 2', players: ['Ryan Davis', 'Alex Miller'] },
    { label: 'Doubles 3', players: ['Matt Wilson', 'Kevin Moore'] },
  ],
  notes: 'Demo scenario for testing messaging flow',
}

export const demoAvailability = [
  { name: 'John Smith', status: 'yes' },
  { name: 'Mike Johnson', status: 'yes' },
  { name: 'Chris Lee', status: 'no' },
  { name: 'David Brown', status: 'yes' },
]

export const demoResponses = [
  { name: 'John Smith', response: 'confirmed' },
  { name: 'Mike Johnson', response: 'confirmed' },
  { name: 'Chris Lee', response: 'no response' },
  { name: 'David Brown', response: 'tentative' },
]