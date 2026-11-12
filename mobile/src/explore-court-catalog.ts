import zipCenters from './explore-stl-zip-centers.json'
import type {HittingPlan} from '../../lib/hitting-plan'

export type CourtPoint={lat:number;lon:number}
export type ExploreCourt={
 id:string;name:string;area:string;destination:string;source?:string;
 access:'public'|'club'|'private';point?:CourtPoint;accessNote?:string;
 bookingPhone?:{number:string;extension?:string};
}

export const stLouisCourtSource='https://www.stlouis-mo.gov/parks/parks/browse-parks/amenities.cfm?amenitySubtypeID=46'
const parksUrl='https://www.stlouis-mo.gov/parks/parks/browse-parks/amenity.cfm?id='
const clubSource='https://vettasports.com/rental/tennis-courts/'
const creveCoeurParks='https://crevecoeurmo.gov/284/Parks'

// Points are from the City's amenity maps, converted from Missouri East State Plane feet.
const parks:[number,string,string,number?,number?][]=[
 [344,'Dwight Davis Tennis Center','Forest Park',38.642668,-90.284665],
 [284,'Francis Park Tennis Courts','St. Louis Hills',38.583204,-90.302321],
 [334,'Tilles Park Tennis Courts','Lindenwood Park',38.600149,-90.288978],
 [212,'Benton Park Tennis Courts','Benton Park',38.597886,-90.224062],
 [228,'Carondelet Tennis Courts','Carondelet Park',38.559065,-90.262857],
 [173,'Chambers Park Tennis Courts','Chambers Park',38.640757,-90.223555],
 [128,'Fairground Tennis Courts','Fairground Park',38.666112,-90.226292],
 [287,'Francis Slay Park Tennis Court','Francis R. Slay Park',38.608137,-90.310344],
 [292,'Franz Park Tennis Courts','Franz Park',38.622046,-90.302518],
 [200,'Gregory J. Carter Tennis Courts','Gregory J. Carter Park',38.699221,-90.257379],
 [466,'Lindenwood Park Tennis Courts','Lindenwood Park'],
 [310,'Marquette Park Tennis Courts','Marquette Park',38.583816,-90.239876],
 [207,"O’Fallon Park Tennis Courts","O’Fallon Park",38.679286,-90.217279],
 [370,'Penrose Park Tennis Court','Penrose Park',38.683836,-90.244874],
 [277,'Reservoir Park Tennis Courts','Compton Hill Reservoir Park',38.613638,-90.236101],
 [386,'Sherman Park Tennis Court','Sherman Park',38.664959,-90.262419],
 [326,'Sublette Park Tennis Courts','Sublette Park',38.606639,-90.28209],
 [138,'Tandy Park Tennis Courts','Tandy Park',38.660764,-90.239405],
 [337,'Willmore Park Tennis Courts','Willmore Park',38.56656,-90.296496],
 [181,'Windsor Park Tennis Court','Windsor Park',38.665966,-90.203863],
 [162,'Yeatman Park Tennis Courts','Yeatman Square Park',38.648866,-90.217063],
]
const featured:Record<number,{id:string;destination:string}>={
 344:{id:'dwight-davis',destination:'5620 Grand Dr, St. Louis, MO'},
 284:{id:'francis-park',destination:'Francis Park Tennis Courts, St. Louis, MO'},
 334:{id:'tilles-park',destination:'Tilles Park Tennis Courts, Hampton Ave and Fyler Ave, St. Louis, MO'},
}

// Municipal facility addresses, with municipal map points or Census address matches.
const suburbanParks:readonly ExploreCourt[]=[
 {id:'ballwin-vlasis',name:'Vlasis Park Tennis Courts',area:'Ballwin',destination:'300 Park Dr, Ballwin, MO 63011',source:'https://www.ballwin.mo.us/Facilities/Facility/Details/Vlasis-Park-8',access:'public',point:{lat:38.596133,lon:-90.541209}},
 {id:'ballwin-new-ballwin',name:'New Ballwin Park Tennis Courts',area:'Ballwin',destination:'329 New Ballwin Rd, Ballwin, MO 63021',source:'https://www.ballwin.mo.us/Facilities/Facility/Details/New-Ballwin-Park-9',access:'public',accessNote:'Shared tennis and pickleball courts',point:{lat:38.578978,lon:-90.557805}},
 {id:'creve-coeur-venable',name:'Venable Memorial Park Tennis Courts',area:'Creve Coeur',destination:'10630 Country View Dr, Creve Coeur, MO 63141',source:creveCoeurParks,access:'public',point:{lat:38.662938,lon:-90.411644}},
 {id:'creve-coeur-conway',name:'Conway Park Tennis Court',area:'Creve Coeur',destination:'12301 Conway Rd, Creve Coeur, MO 63141',source:creveCoeurParks,access:'public',point:{lat:38.643879,lon:-90.44968}},
 {id:'creve-coeur-lake-school',name:'Lake School Park Tennis Courts',area:'Creve Coeur',destination:'581 Coeur De Ville Rd, Creve Coeur, MO 63141',source:creveCoeurParks,access:'public',point:{lat:38.667369,lon:-90.449759}},
 {id:'webster-groves-blackburn',name:'Blackburn Park Tennis Courts',area:'Webster Groves',destination:'421 Edgar Rd, Webster Groves, MO 63119',source:'https://www.webstergrovesmo.gov/171/Blackburn-Park',access:'public',point:{lat:38.582846,lon:-90.345896}},
 {id:'webster-groves-barnickel',name:'Barnickel Park Tennis Courts',area:'Webster Groves',destination:'1101 N Bompart Ave, Webster Groves, MO 63119',source:'https://www.webstergrovesmo.gov/170/Barnickel-Park',access:'public',point:{lat:38.6066,lon:-90.343475}},
 {id:'webster-groves-larson',name:'Larson Park Tennis Courts',area:'Webster Groves',destination:'2 Denver Place, Webster Groves, MO 63119',source:'https://www.webstergrovesmo.gov/177/Larson-Park',access:'public',point:{lat:38.594257,lon:-90.370749}},
 {id:'webster-groves-tennis-center',name:'Webster Groves Tennis Center',area:'Webster Groves',destination:'1 E Glendale Rd, Webster Groves, MO 63119',source:'https://www.webstergrovesmo.gov/187/Tennis-Center',access:'public',accessNote:'Daily admission in season',point:{lat:38.57637,lon:-90.358647}},
 {id:'stl-county-tilles',name:'Tilles Park Tennis Court (County)',area:'St. Louis County',destination:'9551 Litzsinger Rd, St. Louis, MO 63124',source:'https://co.stlouiscountymo.gov/st-louis-county-departments/parks/places/tilles-park/location-maps/tilles-park-map/',access:'public',point:{lat:38.619299,lon:-90.364256}},
]

// The invite picker uses operator-listed tennis clubs. Points are Census address matches.
export const stLouisHittingClubs:readonly ExploreCourt[]=[
 {id:'vetta-concord',name:'Vetta Concord Racquet Sports',area:'Concord',destination:'12320 Old Tesson Rd, St. Louis, MO 63128',source:clubSource,access:'club',accessNote:'Member court rentals',point:{lat:38.511642,lon:-90.371951},
  bookingPhone:{number:'+13148423111',extension:'3'}},
 {id:'vetta-sunset',name:'Vetta Sunset',area:'Sunset Hills',destination:'10911 Gravois Industrial Ct, St. Louis, MO 63128',source:clubSource,access:'club',accessNote:'Member court rentals',point:{lat:38.512021,lon:-90.410392},
  bookingPhone:{number:'+13148492327'}},
 {id:'vetta-west',name:'Vetta West Racquet Sports',area:'St. Peters',destination:'1330 Harvestowne Industrial Dr, St. Peters, MO 63304',source:clubSource,access:'club',accessNote:'Member court rentals',point:{lat:38.739865,lon:-90.607003},
  bookingPhone:{number:'+16364410006'}},
 {id:'frontenac-racquet-club',name:'Frontenac Racquet Club',area:'Frontenac · Vetta Sports',destination:'10455 German Blvd, St. Louis, MO 63131',source:'https://frcstl.com/tennis-court-rentals-events/',access:'club',accessNote:'Contact club to book',point:{lat:38.644166,lon:-90.408661},
  bookingPhone:{number:'+13149915599'}},
]

export const stLouisCourts:readonly ExploreCourt[]=[
 ...parks.map(([id,name,area,lat,lon]):ExploreCourt=>({
  id:featured[id]?.id??`stl-park-${id}`,name,area,access:'public',source:parksUrl+id,
  destination:featured[id]?.destination??`${name}, St. Louis, MO`,
  ...(lat!==undefined&&lon!==undefined?{point:{lat,lon}}:{}),
 })),
 ...suburbanParks,
 ...stLouisHittingClubs,
]

export function listedExploreCourt(id:string|null|undefined){
 return stLouisCourts.find(court=>court.id===id)
}

export function hittingPlanLocation(court:ExploreCourt){return `${court.name} — ${court.destination}`}

export function hittingPlanCourt(entry:{location:string;hittingPlan?:HittingPlan}){
 return stLouisHittingClubs.find(court=>court.id===entry.hittingPlan?.clubId&&entry.location===hittingPlanLocation(court))
}

export function clubBookingPhone(court:ExploreCourt){
 const phone=court.access==='club'?court.bookingPhone:undefined
 if(!phone)return
 const number=phone.number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/,'($1) $2-$3')
 return {href:`tel:${phone.number}`,label:phone.extension?`${number} ext. ${phone.extension}`:number}
}

// Representative ZIP-area points from the 2025 U.S. Census Gazetteer, limited to metro St. Louis.
export function stLouisZipPoint(zip:string):CourtPoint|undefined{
 const center=(zipCenters as Record<string,number[]>)[zip]
 return center?{lat:center[0],lon:center[1]}:undefined
}

export function courtDistanceMiles(a:CourtPoint,b:CourtPoint){
 const radians=Math.PI/180
 const dLat=(b.lat-a.lat)*radians,dLon=(b.lon-a.lon)*radians
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLon/2)**2
 return 3958.8*2*Math.asin(Math.sqrt(Math.min(1,h)))
}
