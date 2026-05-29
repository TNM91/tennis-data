import RouteLoadingShell from '@/app/components/route-loading-shell'

export default function Loading() {
  return (
    <RouteLoadingShell
      label="Preparing player results..."
      detail="Preparing player result entry, scheduled match handoffs, and scoring checks."
      pattern="workflow"
    />
  )
}
