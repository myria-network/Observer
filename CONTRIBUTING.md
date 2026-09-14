# Contributing

## Public protocol boundary

Protocol documentation must remain portable and implementation-neutral. It must exclude user-interface behavior, frontend frameworks, cloud infrastructure, machine-specific paths, local homes, credentials, and the operation of any particular Observer deployment.

Each Observer implementation must declare the exact public protocol version it implements. Once the public protocol repository is available, that declaration must include an immutable release tag or commit and link every implemented validation rule to its corresponding public specification.

Implementation guides may describe adapters, deployment, storage, and presentation separately, but they must not redefine protocol validity. A carrier URL, database row, interface label, or application-specific heuristic cannot replace verification required by the referenced protocol version.

Changes to protocol rules and changes to the SDK must be reviewed independently. A protocol-breaking change requires the version and Genesis transition required by the protocol; it must not be introduced as an undocumented SDK compatibility fallback.
