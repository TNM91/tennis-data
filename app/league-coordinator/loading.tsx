import RouteLoadingShell from '@/app/components/route-loading-shell'

export default function Loading() {
  return (
    <RouteLoadingShell
      label="Loading Coordinator workspace..."
      detail="Preparing league setup, schedules, results, standings, and Data Assist refresh paths."
      pattern="workflow"
    />
  )
}
