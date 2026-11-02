# SurrealDB 3.3.5 feasibility study

`REPORT.md` summarizes the bounded localhost in-memory API/security/performance study. The JSON and JSONL files preserve the exact recorded outcomes; `*.mjs` and `native.rs` preserve the harness/prototype sources. The source/results were copied from `/tmp/rebase-surreal-study` without editing.

The security witness intentionally uses an insecure fixture sign-in-by-name and broad root credentials. It is not an authentication example. The study found three failed rollback expectations in privileged API handlers after writes; HTTP error status did not imply rollback. Performance timings are warm synthetic localhost observations and cannot be compared as complete-engine ratios.

The experiment source used `/tmp/rebase-surreal-study/connection.json`, which held transient local credentials and is intentionally excluded. `server.mjs` generates a fresh random password when run. Reproduction requires fetching the official SurrealDB v3.3.5 release; the runtime binary and 350 MB runtime archive were intentionally excluded. Official pinned code references are in `REPORT.md`; no vendor source is included.
