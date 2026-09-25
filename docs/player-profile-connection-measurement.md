# Public player profile connection path

Use [Vercel Web Analytics](https://vercel.com/tennis-data/tennis-data/analytics) for anonymous choices and `/admin/growth` for account stages. Compare the same date range and split Vercel events by `source` (`player_profile` or `player_profile_share`).

| Step | Signal | Meaning |
| --- | --- | --- |
| Public profile opened | `Player Profile Visit` | A player page finished loading. |
| Connect chosen | `Player Profile Join Click` | A visitor chose Free signup from that page. |
| Other player chosen | `Player Profile Find My Player Click` | A visitor or member went to player search instead. |
| Signup arrived | `Player Profile Signup Viewed` | A visitor reached the profile-sourced signup form. |
| Other player chosen at signup | `Player Profile Signup Find My Player Click` | The visitor returned to player search from that form. |
| Confirmation email sent | `/admin/growth` → Public player profiles → Signup requests | The signup request succeeded. |
| Confirmed, connected, paid | The remaining Public player profiles stages in `/admin/growth` | Account and membership progress. |

For the page handoff, compare signup views per 100 join clicks. Compare guest Find my player clicks with join clicks to see whether the viewed record is often someone else's. The Find my player event has an `audience` property (`guest` or `member`) so signed-in choices can be reviewed separately. If people reach signup but few request an account, review the form and email-confirmation promise before changing the public profile. These Vercel counts are events, not unique people; one person can open several profiles or click more than once. The admin stages count distinct accounts. Do not interpret a small or zero cohort as proof of a conversion problem.

Custom event properties contain only the source and, where relevant, audience labels. They do not include player IDs, names, search terms, or account identifiers.
