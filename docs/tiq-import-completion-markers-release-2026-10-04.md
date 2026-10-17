# Import completion markers — October 4, 2026

The importer discarded explicit retirement/default text while extracting numeric scores. This could make an incomplete court look usable to the existing TIQ rating admission rule.

PR 1479 preserves explicit retired, retirement, default, defaulted, walkover and W / O markers in the score cell, normalized to the existing engine's recognized status words. Status is scoped to that court's score cell. This does not infer completion status from short numeric scores, change the rating response formula, or rewrite historical results.

Focused validation: 76 tests passed across importer parsing, import guards, completion markers and the live network adapter. Targeted lint passed. Full hosted CI run 37213061599 passed: 3,298 tests, lint, type checking, extension syntax, production build, schema audit and captain weekly continuity. PR 1479 merged as `56f5a51190895e329fdabaafb50b38617579b68a`.

Production deployment `dpl_FYsic1SiJP76cR5n64gpwLY1evGv` is READY on www.tenaceiq.com and matches the merge commit. The live methodology endpoint returned HTTP 200. Importer-to-rating behavior was verified by focused integration tests, not by submitting a synthetic court to production.

Existing imported rows that lost their markers require renewed source evidence through normal refresh/reconciliation. A conflict between old numeric evidence and a newly retained incomplete status must remain reviewed rather than silently overriding another source. The 96 abbreviated-score candidates remain an internal review list, not a proven set of invalid ratings.
