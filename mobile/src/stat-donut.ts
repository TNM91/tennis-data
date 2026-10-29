import {html} from './match-details'
/** A graph of a known percentage. Missing data stays neutral, never a zero result. */
export function statDonutHtml(value:number|null,label:string){
 const percent=typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?Math.round(value):null
 return `<div class="stat-donut${percent===null?' is-empty':''}" role="img" aria-label="${html(label)}: ${percent===null?'no decided results':percent+'%'}"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="stat-donut-track" cx="60" cy="60" r="50"/>${percent!==null&&percent>0?`<circle class="stat-donut-fill" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="${percent} 100" transform="rotate(-90 60 60)"/>`:''}</svg><span class="stat-donut-value" aria-hidden="true">${percent===null?'—':percent+'<small>%</small>'}</span></div>`
}
