# FeedLand Testing Roadmap

This roadmap tracks test coverage we exercise inside `feedlandtesting` to inform upstream proposals for `scripting/feedland`.

#### 10/31/25; 12:00:51 AM by JES -- Establishing coverage targets

Context:
- Topic / subsystem: holistic testing strategy for FeedLand service and database layers
- Related files or endpoints: feedland.js, database/database.js, blog.js, HTTP API documented in `contributing/apiOverview.md`

Highlights:
- Current state: initial `node:test` harness in `tests/` covering blog URL helpers, database conversion routines, and selected GET handlers via stubbed `daveappserver` callbacks (`npm test`).
- New tooling: `scripts/smoke.sh` for manual curl-based smoke checks, `scripts/bench-getriver.js` for ad-hoc latency measurements, `scripts/setup.js` for interactive/CLI config generation (with optional local MySQL provisioning), and `notes/codeReviews/perfBaselines.md` to log future results.
- Next coverage goals:
  - **Unit tests**: extend beyond conversion helpers to subscription logic, likes toggles, and Markdown handling using fixtures.
  - **Integration tests**: deepen beyond stubbed GET handlers to include authenticated flows once session strategy is finalized.
  - **Smoke / E2E scripts**: integrate the new smoke and bench commands into the release checklist after they’re exercised on staging.
  - **Performance regression checks**: capture benchmark results in `perfBaselines.md` once representative data is available.
- Tooling considerations: continue relying on `node:test` + `node:assert` to avoid third-party dependencies; use helper stubs to prevent outbound calls.
- Process alignment: fold the suite into the release checklist and plan a CI job once coverage broadens.

#### 11/02/25; 04:45:00 PM by Codex -- Fresh dependency installs for harness

Context:
- Topic / subsystem: automated test harness (`scripts/run-tests.sh`)
- Related files: scripts/run-tests.sh, package.json, tests/*

Highlights:
- To keep this fork clean we don’t check in `node_modules/`, which meant past runs failed immediately when Node couldn’t resolve upstream packages like `daveappserver`, `feedlanddatabase`, `marked`, etc.
- Updated the harness to wipe `node_modules/`, run `npm install --prefer-online --no-save`, generate a throwaway config, execute `npm test`, and then remove the temporary directory plus dependencies. Each run now pulls the latest semver-compatible upstream releases while leaving the repo pristine.
- Added notes to example runs (`/tmp/feedland-tests-XXXXXX/config.json`) so reviewers know where the generated config lives if they need to inspect it.

Follow-up:
- [ ] Consider capturing dependency versions in the run log so we can diff when upstream publishes updates.
- [ ] Evaluate adding a flag to skip reinstalling packages when iterating locally and speed outweighs freshness.

#### 11/02/25; 05:25:00 PM by Codex -- Subscription coverage and feed fixtures

Context:
- Topic / subsystem: subscription routes, reading list bookkeeping, feed format coverage
- Related files: tests/http/httpHandlers.test.js, tests/database/subscribeToFeed.test.js, tests/feeds/formatParsing.test.js, tests/fixtures/feeds/*

Highlights:
- Added authenticated GET coverage for `/subscribe`, `/unsubscribe`, and `/unsublist`, stubbing the database layer to ensure the routes resolve the caller via `getUserRecFromEmail` and pass the expected feed URL to `feedlanddatabase` helpers.
- Extended database tests to confirm `deleteReadingListSubscription` performs scoped deletes (guarding against overlapping reading lists) and that `isUserSubscribed` honors the `urlReadingList` filter.
- Introduced fixture feeds (RSS 2.0, Atom 1.0, RSS 1.0/RDF) plus parsing tests against `davefeedread.parseString` so we have local artifacts representing every format `reallysimple` supports.

Follow-up:
- [ ] Add explicit tests for `checkSubsForOneUserAndOneReadingList` once we introduce an injectable outline fetcher to avoid stubbing `request`.
- [ ] Cover `/opmlsubscribe` end-to-end with fixture OPML once upload plumbing is stubbed.

Milestones:
1. Define test environment setup (mock config, local MySQL schema) and commit fixtures. **(in progress: stubbed config in place; DB fixtures outstanding)**
2. Implement foundational unit tests for `database.saveItem`, `database.subscribeToFeed`, and `blog` formatting helpers.
3. Expand HTTP integration suite (e.g., `/subscribe`, `/setsubscriptioncategories`, `/getreadinglistsubscriptions`) with authenticated scenarios.
4. Script smoke tests (curl wrappers) mirroring manual checks; document in `notes/_TEMPLATE.md` for reproducibility. **(smoke script created; pending validation against staging)**
5. Integrate tests into CI and document run commands in README / worknotes.
6. Establish performance regression script leveraging existing load-test tools; tie into review plan. **(bench script scaffolded; baseline collection pending)**

Follow-up:
- [x] Draft fixtures/harness approach (`node:test`, module stubs). (Owner JES)
- [x] Automate unit + integration runs under `npm test`. (Owner JES)
- [ ] Publish smoke test scripts and update release checklist. (Owner JES)
- [ ] Capture performance regression baseline results and store under `notes/codeReviews/perfBaselines.md`. (Owner JES)
