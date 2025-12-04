# GitHub Copilot Instructions for `rvm-designacoes`

## Mission & Boundaries
- Goal: automate fair weekly assignments for the "Nossa Vida e Ministério" meeting while honoring teocratic filters and elder approvals.
- Stay aligned with the incremental plan in `docs/plan.md`: Model ➜ Core ➜ API ➜ UI. Never couple UI components to the core engine.
- Cross-module contracts are JSON objects defined in `src/types/models.ts`; keep them as the single source of truth.

## Architecture Snapshot
- Frontend: React + Vite + Tailwind (see `src/App.tsx`, `src/index.css`). Labels/UI copy stay in Portuguese, code entities in English.
- Core Logic: `src/core/AssignmentEngine.ts` orchestrates `AssignmentFilter`, `RankingEngine`, `TimingCalculator`. Treat it as headless service so it can later back an API.
- Data & Persistence: currently mocked via `src/mocks/mockData.ts`, but long-term target is Firestore + Firebase Auth (see `docs/stack.md`). Build everything to accept JSON blobs so backend/front can evolve independently.

## Domain Objects & Rules
- `Publisher` carries RBAC (`authorityLevel`), approvals (`isApprovedForTreasures`, `isApprovedForEBC_*`), availability, and helper willingness. Always consult these flags before status changes.
- `MeetingPart` defines `section`, `teachingCategory`, `requiresHelper`, `requiresApprovalByElder`, and `duration`. Those drive filtering, approvals, and timing.
- `AssignmentHistory` feeds cooldown logic: penalize repeat `partType` within 56 days (see `RankingEngine.calculateScore`).

## Assignment Pipeline
- Filter: `AssignmentFilter.getEligibleCandidates` drops publishers failing availability, gender, privilege, approval, or duplicate-in-week checks. Extend this file for any new hard rule.
- Rank: `RankingEngine.rankCandidates` scores by $(days\ since\ last)$ and subtracts 500 when cooldown triggers; never bypass this function when choosing people.
- Pairing: When `requiresHelper` is true, rerun the same pipeline excluding the titular ID (see `AssignmentEngine.selectBestCandidate`).
- Approval: Initial `approvalStatus` flips to `PENDING_APPROVAL` if part or publisher demands it. Enforce that only ELDER authority levels transition to `APPROVED/REJECTED` once API/UI exist.
- Timing: `TimingCalculator.calculateTimings` walks the assignments in order, using `MeetingPart.duration` and a default start time of 19:30. Provide durations on every part or timings will drift.

## Developer Workflows
- Install deps: `npm install`. Run dev server with `npm run dev`; build with `npm run build`. Use `npm run lint` before commits.
- Exercising the engine: `npm run test:engine` executes `scripts/test-engine.ts`, prints assignments with names, helper info, and approval warnings. Update `src/mocks/mockData.ts` to simulate edge cases before touching UI.
- There are no Jest/Vitest suites yet; when adding tests, colocate under `src/core/__tests__` and stub data via the existing mock module for consistency.
- Keep JSON-based APIs even inside the frontend: components should call the engine with typed POJOs rather than accessing internals.

## UI & Data Conventions
- Tailwind is mobile-first; prefer utility classes plus `clsx`/`tailwind-merge` for variants. Avoid inline styles unless dynamic calculations are required.
- Any new component exporting meeting data should remain presentation-only and accept plain assignments as props (see `src/components/PrintLayout.tsx` for reference pattern).
- When surfacing statuses, show Portuguese labels but keep enum values (`DRAFT`, `PENDING_APPROVAL`, etc.) intact in code paths to match `models.ts`.

## Gotchas & Future Hooks
- The repo mentions `scripts/generate-mocks.ts` but it does not exist; if mock generation is required, follow the structure of `src/mocks/mockData.ts` and keep IDs stable for regression checks.
- Cooldown penalties are extreme (−500). Failing to supply `AssignmentHistory` entries will over-prioritize "new" publishers; seed at least a minimal history array in tests.
- TimingCalculator assumes the input assignments array respects the meeting order supplied to `generateAssignments`. Preserve original ordering when sorting/rendering to avoid mismatched clocks.
- When integrating Firestore later, ensure OAuth/RBAC enriches `Publisher.authorityLevel`; the frontend should never guess permissions locally.
