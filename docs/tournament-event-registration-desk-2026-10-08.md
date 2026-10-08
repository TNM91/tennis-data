# Event registration desk

Organizers can manage all divisions from one private event roster: add individual players or doubles partners, record manually collected entry payments, keep a waitlist, and confirm teams into a division draw. Search, division/status filters, and readiness checks identify missing partners and balances. Existing draw entries remain visible without assuming their payment status; unknown payments are excluded from collection totals until reviewed.

Registration records are private even for published events. Only managers of both the parent event and division can read or save them. Saves use a database transaction to update the registration and confirmed field together. An outdated row version is rejected. Duplicate participants in a division are rejected. Confirming a doubles team requires two different partners. Field changes require clearing existing courts and scores first; payments and notes can be updated without changing the field. Waitlisting or withdrawal removes the team from an unlocked draw. Public director-managed sign-up behavior is unchanged.

This is a record of payments collected by the director. It does not charge players or issue refunds. Registration notes and payments are not included in public player passes or standings.

## Database rollout

Apply `20261008000100_tournament_event_registration_desk.sql` through the focused migration workflow; no broad database push. Run `supabase/operations/verify-tournament-event-registration.sql`, whose fixtures and edits are rolled back. The migration introduces one table, manager-only SELECT, and an authenticated atomic-save RPC. Anonymous access and direct client table writes are denied.

## Verification

- Readiness and validation tests: partial payment, free entry, singles, missing partners, duplicate partners, invalid amounts, and existing-entry adoption.
- Persistence tests: versioned atomic RPC, stale/network failures, and load-error handling.
- Rollback database audit: manager save, waitlist exclusion, confirmation, withdrawal, duplicate rejection, version conflict, scored/scheduled field protection, payment-only edit, unrelated-user read/write denial, anonymous denial, and direct-write denial.
- Browser sample preview: partner validation, failed-save retry, successful confirmation, waitlist filter, desktop and 390px editor/layout with no overflow or console errors. Sample data is isolated from real events.
