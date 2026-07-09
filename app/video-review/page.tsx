import SiteShell from '@/app/components/site-shell'
import VideoReviewClient from './video-review-client'

export default function VideoReviewPage() {
  return (
    <SiteShell active="/mylab">
      <VideoReviewClient />
    </SiteShell>
  )
}
