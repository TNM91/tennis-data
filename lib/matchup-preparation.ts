// Shared website rating model. Confidence describes this estimate, not a calibrated guarantee.
const RATING_DIVISOR = 0.45
export function expectedScore(leftRating: number, rightRating: number) {
  const exponent = (rightRating - leftRating) / RATING_DIVISOR
  return 1 / (1 + Math.pow(10, exponent))
}

export function getConfidenceLabel(favoriteProbability: number) {
  if (favoriteProbability >= 0.75) return 'Very High'
  if (favoriteProbability >= 0.66) return 'High'
  if (favoriteProbability >= 0.58) return 'Moderate'
  if (favoriteProbability >= 0.52) return 'Low'
  return 'Toss-up'
}

export function matchupCourtPlan(favoriteProbability:number,favoriteLabel:string){
 return favoriteProbability>=0.45&&favoriteProbability<=0.55
  ? 'Treat the opening four games as the test: protect serve patterns, notice the first repeatable opening, then commit to it.'
  : `${favoriteLabel} has the current edge. Start with the highest-percentage pattern and make the other side earn every change.`
}
