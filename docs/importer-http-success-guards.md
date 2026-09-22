# Successful source responses are required

The September 5 audit found 13 completed queue pages whose latest retained response was HTTP 503 (`The service is unavailable.`). Two also had false current-season refresh timestamps. Source telemetry exposed a pre-existing gap: responses were preserved and access blocks checked, but other HTTP errors could reach parsing and completion.

The importer now requires an integer HTTP 2xx status before parsing, staging, completing a queue item or advancing current-season freshness. Raw HTTP error evidence remains retained. HTTP 408/500/502/503/504 use the existing bounded, delayed retry policy, without an immediate fetch retry or changes to source pacing. Permanent errors remain visible as errors. Access-block handling takes precedence, including block-marked 503 responses.

Saved-page replay filters to HTTP 2xx before its batch limit and checks again before downloading, parsing or superseding prior evidence. Unknown-status legacy responses are not treated as successful evidence. Parser revision, winner decisions, identity matching, rating math and source request limits are unchanged. Retry-persistence failures now fail the checkpoint visibly.

Regression coverage includes all five queue page types, ordinary success, parser-review results, access blocks, permanent failures, retry exhaustion, failed retry persistence, retained 503 bodies, and mixed cached-response replay.

## Separately authorized data recovery

After production readiness is verified, recheck only the 13 explicitly approved queue IDs against their recorded latest source-page IDs, HTTP status, capture/completion timestamps, queue run IDs and freshness fields. Skip changed or recovered rows. Back up full queue/source metadata in the existing private maintenance table before requeuing, clear only false completion/freshness, and defer retries by the ordinary six-minute interval. Preserve all canonical data and retained HTML. No queue-wide reset or forced source crawl is part of this release.

The separate rating snapshot throughput change is intentionally excluded.
