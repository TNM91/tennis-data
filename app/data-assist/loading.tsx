import RouteLoadingShell from '@/app/components/route-loading-shell'

export default function Loading() {
  return (
    <RouteLoadingShell
      label="Loading Data Assist..."
      detail="Preparing upload review, import history, and tennis record refresh tools."
      pattern="upload"
    />
  )
}
