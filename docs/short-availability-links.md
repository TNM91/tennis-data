# Short personal availability links

- Individual match texts use `/a/<22-character code>`.
- Individual season texts use `/s#<22-character code>`. The fragment keeps the season secret out of the page request and referrer, as before.
- Codes losslessly encode the existing UUID. No new tokens, database migration, third-party service, invitation rotation, or reply changes are needed.
- Both paths return private, non-cacheable redirects to the original availability screens. Match codes are strictly validated; season codes are decoded by the existing private client.
- Existing full-length links remain supported. Expiration, revocation, player scope, and calendar permissions remain with the original APIs.
- Match calendar downloads expand short codes back to the original response token. Season calendars still use their separate calendar token.
- Group team-chat links are unchanged; they are a different signed-in, team-scoped flow.

Regression coverage: `lib/__tests__/availability-short-links.test.ts`, `captain-match-week-links.test.ts`, and `season-kickoff-api.test.ts`. Use synthetic tokens for browser checks; do not create or send real invitations merely to test link formatting.

This implementation does not itself publish the routes. Deploy the routes and their callers together before sending newly shortened production links.

## Verification (September 7, 2026)

- Full lint, standalone typecheck, and production build passed.
- Full regression suite: 2,687 tests across 528 files passed. The final production-header regression was then added; all 10 short-link tests and focused lint passed, followed by another successful production build.
- Built-server GET and HEAD checks passed for both redirects and malformed match codes, including `private, no-store`, `no-referrer`, and `noindex` headers. The site-wide referrer default is explicitly overridden for the short routes.
- Browser checks preserved the season fragment through the redirect and reached both original availability screens. Synthetic inactive invitations remained blocked. No real invites, replies, or calendar records were created or changed.
- Local preview: `http://localhost:3030`. Not published yet.
