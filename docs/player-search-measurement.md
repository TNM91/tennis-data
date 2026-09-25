# Player search profile opens

The public Find page records three Vercel Web Analytics custom events for both visitors and signed-in members:

- `Player Search Results Viewed`: one event after a successful player search with at least one result.
- `Player Search More Viewed`: one event when the visitor reveals another group of results.
- `Player Search Profile Opened`: one event when a result card or the Open Player ID shortcut is clicked.

Properties are limited to result-count or position bands, the click placement, and whether the first eight results had recent-match context (`all`, `some`, or `none`). The clicked result records whether its own context was shown. No player name, search text, player ID, or visitor identifier is sent as a custom property.

In [Vercel Web Analytics](https://vercel.com/tennis-data/tennis-data/analytics), compare `Player Search Profile Opened` with `Player Search Results Viewed` over the same date range. Report **profile opens per 100 result-bearing searches**. Review `context` and `clickedContext` alongside position and placement to see where visitors act. This is an event ratio, not a unique-visitor conversion rate: someone can open more than one profile from a search. The earlier search UI did not record anonymous result views, so there is no comparable pre-instrumentation baseline and this ratio alone cannot establish that match labels caused an improvement. Use it to evaluate future changes and to spot weak result positions or missing context.
