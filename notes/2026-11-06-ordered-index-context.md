# Ordered-index context for agents

Status: research/design memory, 2026-11-06. Standard results and archived evidence
below are distinct from the proposed redesign. This note changes no application
code, checkpoint status or architecture. Preserve semantic guarantees, not the
user's informal names. Units: logical node work, dependent I/O rounds, bytes and
wall time are different quantities.

## 1. Algebra and representation

One index: ordered occurrences with total key `(declared_order, stable_tie)`;
ties distinguish record/occurrence identity. AVL height `h = O(log(n+1))`.
Store subtree size `s(v)=s(left)+1+s(right)`, `s(null)=0`; derive dynamic rank
along a path. Do not persist absolute ranks for all records.

An ordered monoid `(M, combine, identity)` supplies
`A(v)=A(left) combine contribution(v) combine A(right)`. Associativity permits
regrouping, **not reordering**; commutativity/inverses are unnecessary. Size is
the count monoid. Maintain summaries on changed paths and rotations, including
value-only edits without rotations. Exact/range-checked arithmetic must preserve
the declared algebra; ordinary floating-point addition is not exactly associative.
No previous/next pointers are mathematically required; navigable tree structure
or equivalent structural metadata is required. Deterministic aggregate results
do not require a canonical tree shape for every set.

## 2. Per-index cost contract

Assume fixed-size summaries, constant-cost combine/comparison, balanced structure,
and valid metadata. `k` counts returned raw occurrences, not necessarily distinct
source records. Empty/tiny trees use `log(n+1)` conventions.

| Operation | Logical work |
| --- | --- |
| Point lookup; boundary seek; key-to-rank; select rank | `O(h)` each |
| Insert/delete; membership/key move (remove + insert); contribution edit | `O(h)`, including balancing and augmentation |
| Known-root cached full summary/count | `O(1)` node reads |
| Prefix/suffix or contiguous two-bound range aggregate | `O(h)` |
| Enumerate contiguous key/rank window, hydrate `k` bounded-size records | `O(h+k)` |
| Independently call select for every rank | `O(k*h)`; avoid |

Two boundary searches **add** `O(h)+O(h)`; they do not multiply into `O(h²)`.
Key bounds and rank bounds normalize to the same contiguous inorder window;
declare strict/inclusive endpoints and duplicate ties precisely. A range fold
uses maximal contained subtree summaries plus boundary contributions in inorder;
two boundary paths cost `O(h)`, without prefix subtraction/inverses. Enumeration
visits that boundary cover and emitted interior nodes, hence `O(h+k)` with
`Omega(k)` output work. Arbitrary nonindexed predicates/authorization filtering
need not form a contiguous window; small output does not imply small scan work.

## 3. Read scheduling: work versus span

**Sequential successor control:** seek once, then await each next-node/record
fetch. Total work `O(h+k)`; dependent read rounds can be `O(h+k)`.

**Count-pruned batched frontier traversal:** from root, use subtree counts and
inorder offsets to exclude disjoint subtrees; fetch independent children by
frontier, assign included occurrences their output positions, batch hydration,
emit in inorder. This is pruned BFS/batched tree traversal, not a new logarithmic
enumeration bound. Work remains `O(h+k)`; sufficient parallel capacity reduces
dependent tree-read depth to `O(h)`. Independent key-bound pruning is also
possible; ranks are useful, not the sole source of parallelism.

With at most `C` concurrent gets, a level-by-level schedule has capacity waves
`sum_depth ceil(frontier_gets[depth]/C)`, plus hydration waves; these are API
await groups, **not guaranteed wire RTTs**. Bytes, decoding, output buffering,
backpressure, storage queues and concurrency affect elapsed time. Bound the
frontier/output buffers. All node/count/body reads must share one consistent
snapshot or an explicitly proven version-validation protocol. Awaiting all work
does not itself establish consistency. Benefits can occur for small pages too;
large `k` amplifies avoidable serial waits. Do not infer WAN throughput from work
bounds or local process measurements.

## 4. Range dependency versus interval stabbing

A single bound means an ordinary prefix/suffix: locate boundary/rank `O(h)`,
fold its summary `O(h)`, enumerate `O(h+k)`. General two-bound range folds have
the same asymptotic bounds. A dependency interval is a **subscription**, not a
data row range: when a source point changes, find subscriptions containing its
old/new position, then recompute affected dependents from the staged final graph.
This routing assumes stable declared keys. Rank-window subscriptions additionally
need shift invalidation: insertion/deletion before a window can change its members
without the changed occurrence lying inside it. Efficient rank reads alone do
not establish efficient reactive rank-window maintenance.

General interval stabbing matches `lo <= point <= hi` (with declared cut
semantics). Matches need not be contiguous in lower- or upper-endpoint order:
`[1,10], [2,3], [4,8]` stabbed at `5` matches first and third. Two ranks cannot
replace interval-specific discovery. Fixed-orientation one-sided subscriptions
can reduce to a threshold prefix/suffix; do not generalize this to all intervals.
AVL balance alone does not prove `O(log n + matches)` for an arbitrary augmented
interval reporter. Charge visited nodes plus matches; prove the chosen algorithm.
Reporting/recomputing `r` dependents is not `O(h)` merely because discovery uses
a tree. Range aggregation, subscriber discovery and dependent updates are
distinct operations with additive costs.

## 5. Proposed redesign: declarative index forest

Intent, **not an accepted implementation**: one uniform augmented-AVL mechanism;
declared field presence/field lists project records into index memberships,
rather than table/class-specific participation boilerplate. Multiple resource
types may share a tree only through compatible typed key/contribution projections.
Declare desired field/composite combinations; do not generate every permutation.

Before implementation, define: index-definition identity/version, tenant
namespace, optional scope/root/partition, typed order/collation/unit, occurrence
identity/ties, contribution algebra, presence/null rules and atomic membership
reconciliation. Changing/removing a participating field removes the old occurrence
and inserts the new one with all summaries/dependencies maintained atomically.
Field presence must not confer access or let clients forge trusted memberships.
"Global" means a common mechanism/catalog unless explicitly choosing a shared
tree; no implicit cross-tenant tree or shared mutation/population counter.

Normalization changes representation, not inherent costs: `m` memberships still
require their path work. The tree-maintenance component is the sum of heights
over actual changed memberships; `O(r*m*log n)` is a homogeneous estimate,
excluding discovery, guards, bytes, conflicts and external effects. Do not claim
`O(r*log n)` by renaming each membership as a record. Protect absence/ranges and
all read-dependent invariants through the transactional adapter. Shared business
roots can legitimately contend; avoid invented global coordination.

## 6. Evidence and proof boundaries

- Established topics: augmented balanced BST / dynamic order statistics;
  ordered monoid range decomposition; work-span analysis of parallel traversal.
  The bounds above follow height, boundary-cover and output-size arguments, not
  native KV support for rank/offset skipping. Backend ordered scans do not by
  themselves supply logarithmic ordinal skip.
- [Archived parallel read packet](../parallel-read-foundationdb/README.md):
  100,000-member fixture, FoundationDB 7.3.77, three processes on **one host**,
  60 timed samples / 12 cases, independently checked outputs. Local warm native
  reads only; no HTTP/auth/write/mixed-load/multi-host/WAN acceptance. Original
  measurement source, build fingerprints and results remain unchanged.
- [Application mathematical context](https://github.com/DivyeshVora79909/next-base/blob/main/docs/index-mathematics.md)
  already records range-cover, batching and interval-reporting qualifications;
  mutable application documentation is not fresh acceptance evidence. This note
  consolidates those contracts with the user's proposed next design, without
  selecting it or claiming new benchmark results.
