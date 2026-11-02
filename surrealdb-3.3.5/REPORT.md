# SurrealDB function/API feasibility study

Executed against the official SurrealDB 3.3.5 Linux release in an isolated localhost in-memory server. The server is now stopped. No repository files were modified. These are warm synthetic component tests, not a complete rewrite, persistent-storage comparison, distributed deployment, or production capacity assessment.

## Permission and transaction boundary

39 narrow runtime witnesses: 36 expected behaviors passed and three required rollback checks failed. Record users cannot directly read/write a table with PERMISSIONS NONE, and an allowed ordinary UDF does not elevate their table permissions. A DEFINE API handler can access these tables and call a helper marked PERMISSIONS NONE, while preserving caller $auth for explicit ownership checks. Anonymous calls were rejected by the explicit API permission gate. The fixture signin-by-name is intentionally insecure test setup and is not a production authentication example.

In three cases an API handler wrote two records, then THROW returned an error response while both writes persisted: api::invoke, direct HTTP API, and an API calling the throwing UDF. Directly calling the same UDF outside API handling rolled back. Explicit outer CANCEL also rolled back. Exact requests and returned persisted rows are in security-results.json. The source converts handler errors into an ordinary ApiResponse value; do not assume an HTTP500 implies rollback. This observed behavior fails the proposed mutation boundary's atomicity requirement.

Pinned sources: [UDF](https://github.com/surrealdb/surrealdb/blob/v3.3.5/surrealdb/core/src/legacy/expr/function.rs), [API invocation](https://github.com/surrealdb/surrealdb/blob/v3.3.5/surrealdb/core/src/api/invocation.rs).

## RPC, composition and parsing

Root bearer JWT was acquired once for measured performance calls. Repeating Basic auth added about18ms per trivial request in the first campaign; this must not be reported as generic RPC overhead. Bearer medians: inline addition0.691ms HTTP /0.025ms server; stored addition0.756/0.049; ten nested helpers0.855/0.090. RPC run(fn::add)0.841ms, RPC query0.698ms. Fifteen observations each are descriptive samples.

RPC run accepts a function-name string. Inside SurrealQL a string is not a callable; actual closures can be passed to ordinary functions and invoked. Runtime probes confirmed both behaviors. eval::surql was denied under default capabilities. Stored bodies avoid resending their source, but physical UDF bodies are replanned on each call. FOR and array::map await iterations sequentially; batching does not itself prove parallel underlying KV reads. FOR-local LET shadows an outer accumulator, so the tested folds explicitly use array::fold state.

At10000 values, equal array-length requests took3.43ms with a literal SurrealQL array,2.29ms using bound RPC-query variables, and2.60ms with RPC run. This includes serialization, binding and transport; it does not isolate pure parser time. See dispatch-results.json.

## Equivalent summary calculation

All versions calculate count,sum,minPrefix on the same signed-integer vector, with checked native arithmetic and exact expected results. Rust is optimized in-process code without a database or transport. SurrealQL times are reported statement durations, not CPU time, and include its execution machinery. These are not complete-engine speed ratios.

| Values | Native Rust ms | SurrealQL inline fold ms | SurrealQL helper per value ms |
|---:|---:|---:|---:|
|100|0.000048|0.960|1.293|
|1000|0.000556|8.792|11.988|
|10000|0.005644|86.044|120.483|

## Linked discovery and count-pruned BFS

10000 persisted balanced nodes have next/left/right/parent references and subtree counts, plus separate payload records. Chain discovers next and hydrates each record. BFS selects the kth boundary using persisted counts, traverses relevant frontier batches, then hydrates. Its14stages match this synthetic tree's height, not a generic implementation. Every complete record, boundary and continuation is independently checked. Root and k, not expected output IDs, are inputs to the BFS. The benchmark also uses business keys equal to numeric fixture IDs and final ordering by x; this is not a general index library.

| Rows | Chain HTTP ms | BFS HTTP ms | Known-ID bulk HTTP control ms |
|---:|---:|---:|---:|
|50|3.188|5.137|1.285|
|100|5.342|5.658|1.682|
|1000|167.474|27.999|7.554|

Known-ID bulk skips discovery and is not an equivalent pagination algorithm. Chain output array::append may copy accumulated rows and contribute superlinear work. BFS concatenates once per level. Its reported visited counts59/109/1006 exclude rank-boundary selection and final hydration. Internal SELECT concurrency was not measured. No FDB-to-Surreal language comparison can be inferred: backends, topology, dataset and record sizes differ.

## Short load observations

Four3second windows completed32648 HTTP JSON-RPC calls with no observed errors. At concurrency1/8, trivial calls reached2239/5675 requests/s;100-row known-ID reads872.8/2092.9 requests/s. Client and server share a host, root JWT has broad permissions, payloads are small, and the backend is memory. These are short harness observations, not sustained production limits. See load-results.json.

## Decision

SurrealDB offers useful RPC, query, graph and schema abstractions with reasonable local read/API times. It does not remove interpretation costs or the need to maintain exact aggregate, dependency, concurrency and mutation semantics. The tested privileged API failure behavior is a blocker for using the proposed direct mutation surface unchanged. Keep the working native engine while resolving that boundary; only then compare equivalent full transactions and reactive cascades on persistent stores. Neither a complete rewrite nor a performance guarantee follows from these component results.
