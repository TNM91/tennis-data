export const CAPTAIN_AVAILABILITY_REFRESH_MS = 15_000
export const CAPTAIN_AVAILABILITY_UPDATE_NOTICE_MS = 6_000

type AvailabilityResponseSignatureRow = {
  player_id?: string | null
  player_name?: string | null
  status?: string | null
  responded_at?: string | null
}

export function buildCaptainAvailabilityResponseSignature(
  responses: AvailabilityResponseSignatureRow[],
) {
  return responses
    .map((response) => [
      response.player_id?.trim() || '',
      response.player_name?.trim().toLowerCase() || '',
      response.status?.trim().toLowerCase() || '',
      response.responded_at?.trim() || '',
    ].join(':'))
    .sort()
    .join('|')
}
