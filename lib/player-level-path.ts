// My Lab's level-band comparison uses recorded estimates, not an official
// USTA classification or promotion forecast. Never infer missing estimates.
export function playerLevelPath(tiq:unknown,usta:unknown,selfRated=false){
 const valid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=1.5&&value<=7
 const currentTiq=valid(tiq)?tiq:null,ustaDynamic=!selfRated&&valid(usta)?usta:null
 const ustaBase=ustaDynamic===null?null:Math.max(2.5,Math.floor(ustaDynamic*2)/2)
 const nextUstaLevel=ustaBase===null?null:ustaBase+0.5
 const hasLevelProgress=currentTiq!==null&&ustaBase!==null
 const levelProgress=hasLevelProgress?Math.max(0,Math.min(100,((currentTiq-ustaBase)/0.5)*100)):0
 const tiqVsUsta=currentTiq!==null&&ustaDynamic!==null?currentTiq-ustaDynamic:null
 const levelStatus=tiqVsUsta===null?'Building profile':tiqVsUsta>=0.05?'Trending up':tiqVsUsta<=-0.05?'Needs work':'Holding steady'
 const ratingToGo=currentTiq!==null&&nextUstaLevel!==null?Math.max(0,nextUstaLevel-currentTiq):null
 return {ustaBase,nextUstaLevel,hasLevelProgress,levelProgress,tiqVsUsta,levelStatus,ratingToGo}
}
