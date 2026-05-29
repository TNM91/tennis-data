import RouteLoadingShell from '@/app/components/route-loading-shell'

export default function Loading() {
  return (
    <RouteLoadingShell
      label="Preparing Team Hub..."
      detail="Checking team scope, availability, lineup context, and match-week notes."
      pattern="workflow"
    />
  )
}
