/** Winner relative to the selected left side. Unknown or invalid source results stay pending. */
export function matchupOutcome(leftSide:unknown,winnerSide:unknown):'A'|'B'|null {
 if((leftSide!=='A'&&leftSide!=='B')||(winnerSide!=='A'&&winnerSide!=='B'))return null
 return leftSide===winnerSide?'A':'B'
}
