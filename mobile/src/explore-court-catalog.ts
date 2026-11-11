import zipCenters from './explore-stl-zip-centers.json'

export type CourtPoint={lat:number;lon:number}
export type ExploreCourt={
 id:string;name:string;area:string;destination:string;source?:string;
 access:'public'|'club'|'private';point?:CourtPoint;
}

export const stLouisCourtSource='https://www.stlouis-mo.gov/parks/parks/browse-parks/amenities.cfm?amenitySubtypeID=46'
const parksUrl='https://www.stlouis-mo.gov/parks/parks/browse-parks/amenity.cfm?id='
const clubSource='https://vettasports.com/rental/tennis-courts/'

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

export const stLouisCourts:readonly ExploreCourt[]=[
 ...parks.map(([id,name,area,lat,lon]):ExploreCourt=>({
  id:featured[id]?.id??`stl-park-${id}`,name,area,access:'public',source:parksUrl+id,
  destination:featured[id]?.destination??`${name}, St. Louis, MO`,
  ...(lat!==undefined&&lon!==undefined?{point:{lat,lon}}:{}),
 })),
 // The operator publishes the addresses and member rental policy. Points are Census address matches.
 {id:'vetta-concord',name:'Vetta Concord Racquet Sports',area:'Concord',destination:'12320 Old Tesson Rd, St. Louis, MO 63128',source:clubSource,access:'club',point:{lat:38.511642,lon:-90.371951}},
 {id:'vetta-sunset',name:'Vetta Sunset',area:'Sunset Hills',destination:'10911 Gravois Industrial Ct, St. Louis, MO 63128',source:clubSource,access:'club',point:{lat:38.512021,lon:-90.410392}},
]

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
