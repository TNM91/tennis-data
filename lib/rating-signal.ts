export function ratingSignal(diff:number){
 return {label:diff>=.15?'Hot':diff>=.07?'Rising':diff<=-.15?'Cooling':diff<=-.07?'Softening':'Stable',color:diff>=.07?'#9be11d':diff<=-.07?'#f87171':'rgba(190,210,240,0.6)',tone:diff>=.07?'up':diff<=-.07?'down':'flat'}
}
