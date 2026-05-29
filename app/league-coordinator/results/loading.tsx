import RouteLoadingShell from '@/app/components/route-loading-shell'

export default function Loading() {
  return (
    <RouteLoadingShell
      label="Preparing team results..."
      detail="Preparing team match entry, line coverage, score review, and standings context."
      pattern="workflow"
    />
  )
}
