# Research archive handling

This tree contains bounded, independent explorations that informed ReBase Next. It is not application code, a dependency, an acceptance suite, or a claim that a proposed approach is production ready.

Keep each experiment self-contained. Preserve original measurement evidence byte for byte; do not rewrite result rows, smooth measurements, or elevate assumptions to observations. Add new interpretation in a dated note and retain the original file and its SHA-256. Record source paths, source/repository revision, binary fingerprint, commands and environment limits whenever known. Mark missing provenance as unknown.

Do not run archived harnesses without reviewing their source and recreating an isolated environment. Some scripts reference the historical `/workspace/ReBase` checkout and local build products. The archive intentionally excludes runtime binaries, native stores, FoundationDB cluster files, credentials, dependencies, and process logs. Rebuild only from independently obtained sources and current manifests. Do not vendor SurrealDB source; cite the official release tag.

Z3 appears only as an optional original-ReBase research dependency in the equipment harness. It is not a ReBase Next runtime dependency.
