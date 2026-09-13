# Forge

**Verification-first agentic control plane.**

Forge inverts the typical agent paradigm: **models propose actions, the system decides verdicts.** The LLM never grades its own work.

## Core Pillars

1. **Deterministic State Machine**: `plan -> build (parallel worktrees) -> verify (merge gate + contract stack) -> diagnose (bounded, evidence-driven) -> merge -> done | failed`.
2. **The 6-Layer Contract Stack**:
   - `L0`: typecheck / build
   - `L1`: unit + property tests
   - `L2`: API contract tests
   - `L3`: browser scripts
   - `L4`: visual diff against baseline
   - `L5`: independent LLM judge with evidence bundle
3. **Parallel Lanes & Git Worktrees**: Concurrently executes tasks across isolated git worktrees (`alpha`, `beta`, `gamma`), merging behind a strict green gate.
4. **Git Realms & Time Travel**: Every mutation creates a git snapshot tag (`forge/ck-N`). Failed iterations rewind safely without dirtying the workspace.
5. **Capability-Based Model Router**: Routes task kinds (`architect`, `code`, `debug`, `judge`) by capability scores and enforces model separation (coder models cannot judge their own output).
6. **Evidence Bundles**: Diagnosticians and judges receive concrete artifacts (diffs, console logs, test output tails), not hallucinations.

## Quickstart

```bash
cd forge && pip install -e .

# Run the PlantWatch offline demo with injected regression detection:
forge --root /tmp/plantwatch run --demo "make the dashboard cards smaller"

# Run the local IDE server:
forge serve --port 4141

# Time-travel and query:
forge status
forge rewind 1
forge ask "where is auth handled"
```
