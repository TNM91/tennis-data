# Student practice tracker

The Coach student record groups its loaded assignments into Assigned, Needs feedback and Feedback given quick views. A status selector also exposes all completed work, drafts and archived assignments. Completed records without a player check-in remain accessible; archived proof never counts as pending feedback.

Search matches only the assignment title or tennis focus, using literal case-insensitive Unicode-normalized text. It filters records already loaded for the selected student, performs no network requests, and retains the search input and focus while updating results. The display explicitly labels the latest-100 boundary when older work is omitted; counts describe loaded assignments, not lifetime totals or a player's skill rating.

Pending feedback is ordered by oldest check-in first. Assigned practice is ordered by due date, with undated work last; overdue and due-today labels use the existing local-calendar rules. Opening a result resolves its exact assignment ID. Returning restores the filters and focuses the same row. Refreshing and confirmed saves retain filters while recalculating counts; changing students or accounts clears them. Failed refreshes remove stale work.

The tracker uses the shared navy surfaces, quiet borders and green court-inlay selection. Its result count is plain live-region text. Narrow layouts with larger text stack the quick views to keep words readable. Existing feedback review, read-before-retry recovery, paused connections and invitations keep their normal permissions and save behavior.

No backend migration, new endpoint, persistent device cache, polling or paid service is introduced. Verification covers ordering and status classification, both phone browser engines at 320/390px, large text, retained focus, exact assignment routing, uncertain-save recovery, bounded history and account cleanup. Physical iPhone/VoiceOver acceptance remains separate from synthetic browser checks.
