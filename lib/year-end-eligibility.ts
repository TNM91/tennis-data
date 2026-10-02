
export const MISSOURI_2025_TRILEVEL_POLICY = 'https://www.usta.com/content/dam/usta/sections/missouri-valley/pdfs/adults/2025-missouri-league-rules-and-regs.pdf'

/** Diagnostic inclusion only. Year-end use and dynamic disqualification are different rules. */
export function yearEndDiagnosticEligibility(leagueName: string, season: number, officialContext?: { section: string; district: string }) {
  if (/\b(?:mixed|combo|tournament)\b/i.test(leagueName)) return { eligible: false, policy: 'unconfirmed', sourceUrl: null }
  if (/\btri[-\s]?level\b/i.test(leagueName)) {
    const confirmed = season === 2025 && officialContext?.section === 'USTA/MISSOURI VALLEY' && officialContext?.district === 'MISSOURI'
    return { eligible: confirmed, policy: confirmed ? 'missouri-2025-trilevel-year-end' : 'unconfirmed', sourceUrl: confirmed ? MISSOURI_2025_TRILEVEL_POLICY : null }
  }
  // Retains the existing standard-Adult diagnostic assumption, not a release policy.
  return { eligible: /\badult\b/i.test(leagueName), policy: 'standard-adult-diagnostic', sourceUrl: null }
}


