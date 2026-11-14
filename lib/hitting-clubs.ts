export type CourtPoint = { lat: number; lon: number }
export type ExploreCourt = {
  id: string; name: string; area: string; destination: string; source?: string
  access: 'public' | 'club' | 'private'; point?: CourtPoint; accessNote?: string
  bookingPhone?: { number: string; extension?: string }
}

const clubSource = 'https://vettasports.com/rental/tennis-courts/'
export const stLouisHittingClubs: readonly ExploreCourt[] = [
  {id:'vetta-concord',name:'Vetta Concord Racquet Sports',area:'Concord',destination:'12320 Old Tesson Rd, St. Louis, MO 63128',source:clubSource,access:'club',accessNote:'Member court rentals',point:{lat:38.511642,lon:-90.371951},
    bookingPhone:{number:'+13148423111',extension:'3'}},
  {id:'vetta-sunset',name:'Vetta Sunset',area:'Sunset Hills',destination:'10911 Gravois Industrial Ct, St. Louis, MO 63128',source:clubSource,access:'club',accessNote:'Member court rentals',point:{lat:38.512021,lon:-90.410392},
    bookingPhone:{number:'+13148492327'}},
  {id:'vetta-west',name:'Vetta West Racquet Sports',area:'St. Peters',destination:'1330 Harvestowne Industrial Dr, St. Peters, MO 63304',source:clubSource,access:'club',accessNote:'Member court rentals',point:{lat:38.739865,lon:-90.607003},
    bookingPhone:{number:'+16364410006'}},
  {id:'frontenac-racquet-club',name:'Frontenac Racquet Club',area:'Frontenac · Vetta Sports',destination:'10455 German Blvd, St. Louis, MO 63131',source:'https://frcstl.com/tennis-court-rentals-events/',access:'club',accessNote:'Contact club to book',point:{lat:38.644166,lon:-90.408661},
    bookingPhone:{number:'+13149915599'}},
]

export function listedHittingClub(id: unknown) {
  return stLouisHittingClubs.find(club => club.id === id)
}
