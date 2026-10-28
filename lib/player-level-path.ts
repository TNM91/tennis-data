// TIQ band progress describes current estimated playing strength, not USTA promotion.
export function playerLevelPath(tiq:unknown,ustaCurrent:unknown,selfRated=false){
 const valid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=1.5&&value<=7
 const currentTiq=valid(tiq)?tiq:null,currentUsta=valid(ustaCurrent)&&Number.isInteger(ustaCurrent*2)?ustaCurrent:null
 const tiqBase=!selfRated&&currentTiq!==null?Math.floor(currentTiq*2)/2:null
 const nextTiqBand=tiqBase===null||tiqBase>=7?null:tiqBase+0.5
 const hasLevelProgress=currentTiq!==null&&tiqBase!==null&&nextTiqBand!==null
 const levelProgress=hasLevelProgress?Math.max(0,Math.min(100,((currentTiq-tiqBase)/0.5)*100)):0
 const tiqVsUsta=currentTiq!==null&&currentUsta!==null?currentTiq-currentUsta:null
 const levelStatus=selfRated?'Starting estimate':tiqBase===null?'Building profile':nextTiqBand===null?'Top TIQ band':levelProgress>=70?'Upper TIQ band':'Within TIQ band'
 const ratingToGo=hasLevelProgress?Math.max(0,nextTiqBand-currentTiq!):null
 return {currentUsta,tiqBase,nextTiqBand,hasLevelProgress,levelProgress,tiqVsUsta,levelStatus,ratingToGo}
}
