import RouteLoadingShell from '@/app/components/route-loading-shell'

export default function Loading() {
  return (
    <RouteLoadingShell
      label="Loading Captain workspace..."
      detail="Checking team scope, availability, lineup context, and match-week notes."
      pattern="workflow"
    />
  )
}
