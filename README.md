# ReBase research archive

This repository preserves independent exploratory research that informed ReBase Next. The current application and its architecture, operating instructions, and checkpoint records 01–80 remain in [Next-Base](https://github.com/DivyeshVora79909/Next-Base), including its [architecture and current status](https://github.com/DivyeshVora79909/Next-Base/blob/main/README.md), [agent instructions](https://github.com/DivyeshVora79909/Next-Base/blob/main/AGENTS.md), and [current handoff](https://github.com/DivyeshVora79909/Next-Base/blob/main/CONTEXT.md). The research archive has no runtime or package dependency on Next-Base. It links back to that repository so readers can follow current application decisions without treating historical experiments as active instructions.

## Archive layout

- [`notes/2026-11-06-ordered-index-context.md`](notes/2026-11-06-ordered-index-context.md) is a compact agent reference for augmented-AVL work/span bounds, rank/key range reads, interval-stabbing distinctions and the proposed field-driven index forest. It is design context, not an application redesign or new benchmark evidence.
- `surrealdb-3.3.5/`, `parallel-read-foundationdb/`, and `equipment-adaptive-population/` contain three bounded research packets staged from isolated experiment directories. Their README files record scope, provenance, and limitations.
- `archive/ReBase/rebase-next/` preserves the original tracked ReBase Next research reports 81 and 82, their selected source/evidence files, and a snapshot of the original `AGENTS.md`, `README.md`, and `CONTEXT.md`. The reports and snapshots are byte-for-byte from original commit `270d875a6e97b276d9cf7876a9bb4666a21d0f53`. Some historical Markdown links point to material outside this targeted archive; `archive/ReBase/rebase-next/ARCHIVE-NOTE.md` explains this boundary.
- `archive/ReBase/package.json`, `archive/ReBase/dev-tools/fixtures/solver.js`, and `archive/ReBase/LICENSE` preserve the original ReBase context used by report 82's relative links. The ReBase license is also preserved as `LICENSES/ReBase-MIT.txt`; this repository's existing `LICENSE` remains its own.
- `manifest.json` records hashes and source paths for every archived file except itself, plus experiment and source provenance.

The ReBase Next work, its accepted S0/N1–N6 application checkpoints, and current architecture remain in the [Next-Base repository](https://github.com/DivyeshVora79909/Next-Base). Original reports 81–82 are archived here as dated research records; their bounds and current continuation decisions must be read from Next-Base.

## Limits

These files preserve specific experiments and their evidence. They do not certify a production architecture, general performance, multi-host behavior, unrestricted population, or a universal valid-data generator. FoundationDB measurements in the included studies used local processes on a single host. The original ReBase Z3 module appears only as an optional research dependency, not a Next-Base runtime dependency.

See [`AGENTS.md`](AGENTS.md) for archive handling rules. URLs and repository names may change; update links and provenance when they do.
