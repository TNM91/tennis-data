import {isValidCalendarDate} from './calendar-date'
export type TrajectoryPoint={date:string;rating:number|null}
export function normalizeTrajectory(input:TrajectoryPoint[]):TrajectoryPoint[]{
 if(!Array.isArray(input)||input.length>120)return []
 const days=new Map<string,number|null>()
 for(const point of input){
  if(!point||typeof point.date!=='string'||!isValidCalendarDate(point.date.slice(0,10))||(point.date.length!==10&&(!/^\d{4}-\d{2}-\d{2}T/.test(point.date)||!Number.isFinite(Date.parse(point.date)))))return []
  const day=point.date.slice(0,10),rating=typeof point.rating==='number'&&Number.isFinite(point.rating)&&point.rating>=1.5&&point.rating<=7?point.rating:null
  if(days.has(day)&&days.get(day)!==rating)days.set(day,null)
  else if(!days.has(day))days.set(day,rating)
 }
 return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,rating])=>({date,rating}))
}
export function trajectoryGeometry(leftInput:TrajectoryPoint[],rightInput:TrajectoryPoint[]){
 const left=normalizeTrajectory(leftInput),right=normalizeTrajectory(rightInput)
 if([left,right].some(points=>points.filter(p=>p.rating!==null).length<3))return null
 const all=[...left,...right],ratings=all.flatMap(p=>p.rating===null?[]:[p.rating]),dates=all.map(p=>Date.parse(p.date+'T12:00:00Z')),min=Math.min(...ratings)-0.1,max=Math.max(...ratings)+0.1,first=Math.min(...dates),last=Math.max(...dates),span=Math.max(last-first,1)
 const n=(v:number)=>Number(v.toFixed(2)),x=(date:string)=>n(28+(Date.parse(date+'T12:00:00Z')-first)/span*744),y=(r:number)=>n(132-(r-min)/Math.max(max-min,0.1)*104)
 const series=(points:TrajectoryPoint[])=>{let pen=false,path='';let lastPoint:{x:number;y:number}|null=null;for(const p of points){if(p.rating===null){pen=false;continue}const point={x:x(p.date),y:y(p.rating)};path+=(path?' ':'')+(pen?'L '+point.x+' '+point.y:'M '+point.x+' '+point.y+' L '+point.x+' '+point.y);pen=true;lastPoint=point}return {path,last:lastPoint!,points}}
 return {left:series(left),right:series(right),start:new Date(first).toISOString().slice(0,10),end:new Date(last).toISOString().slice(0,10),min:n(min),max:n(max)}
}
