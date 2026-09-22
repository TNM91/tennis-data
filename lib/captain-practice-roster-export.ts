import type { CaptainPracticeManagementOverview, CaptainPracticeRosterOverview } from '@/lib/internal-scheduling'

export type PracticeRosterExportKind = 'current' | 'confirmed'

type PracticeRosterExportInput = {
  event: CaptainPracticeManagementOverview['event']
  roster: CaptainPracticeRosterOverview
  kind: PracticeRosterExportKind
  createdAt: Date
}

export function buildPracticeRosterExport({ event, roster, kind, createdAt }: PracticeRosterExportInput) {
  const players = roster.roster.filter((player) => player.responseStatus === 'in' && (kind === 'current' || player.captainConfirmed))
  const title = kind === 'current' ? 'Current practice roster' : 'Captain-confirmed practice roster'
  const createdLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt)
  const practiceLabel = event.title || 'Team practice'
  const when = [event.scheduledDate, event.scheduledTime].filter(Boolean).join(' · ')
  const details = [when, event.facility].filter(Boolean).join(' · ')
  const lines = [
    title,
    practiceLabel,
    details,
    `Snapshot: ${createdLabel}`,
    `${players.length} player${players.length === 1 ? '' : 's'}`,
    '',
    ...players.map((player, index) => `${index + 1}. ${player.playerName} — ${player.captainConfirmed ? 'Confirmed' : player.displayStatus === 'waitlist' ? 'Waitlisted · needs confirmation' : 'In · needs confirmation'}`),
  ]
  const csvRows = [
    ['Practice', 'Date', 'Time', 'Location', 'Roster view', 'Snapshot created', 'Player', 'RSVP', 'Captain confirmed'],
    ...players.map((player) => [
      practiceLabel,
      event.scheduledDate,
      event.scheduledTime,
      event.facility,
      title,
      createdAt.toISOString(),
      player.playerName,
      player.displayStatus === 'waitlist' ? 'Waitlist' : 'In',
      player.captainConfirmed ? 'Yes' : 'No',
    ]),
  ]
  const dateForFilename = event.scheduledDate || createdAt.toISOString().slice(0, 10)
  const filename = `practice-roster-${dateForFilename}-${kind}.csv`

  return {
    title,
    count: players.length,
    text: lines.filter((line, index) => line || index === 5).join('\n'),
    csv: `\uFEFF${csvRows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`,
    filename,
  }
}

function csvCell(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}
