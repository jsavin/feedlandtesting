# FeedLand Testing Implementation Plan

Follow this playbook when extending automated coverage in the `feedlandtesting` fork; successful patterns should be documented and, where appropriate, recommended to the `scripting/feedland` maintainers.

#### 10/31/25; 04:28:26 PM by JES -- Standing up automated coverage with `node:test`

Decision & Rationale
- **Testing harness:** use Node’s built-in `node:test` runner plus `node:assert`. This keeps dependencies at zero, matches our CommonJS environment, and avoids the maintenance overhead of adopting a larger framework.
- **Trade-offs:** we forego advanced features (watch mode, snapshot testing) offered by third-party tools, but gain simplicity, fast adoption, and no need to chase upstream updates. If the needs grow, we can layer a library later without rewriting initial tests.
- **Execution:** tests live under `tests/`, run via `node --test` (aliased to `npm test`), and rely on local fixtures/config stubs. Production code remains untouched unless we expose helpers deliberately.

Work Breakdown (chronological)

1. **Environment scaffolding**
   - Create `tests/` directory with README describing how to run tests.
   - Add `npm test` script (`"node --test"`).
   - Provide a `tests/helpers/config.js` that loads a safe default config (in-memory DB or temp schema) without real credentials.
   - Supply `scripts/setup.js` for generating configs (interactive or via CLI) and optionally provisioning local MySQL for test runs.

2. **Unit Test Suites**
   - *database/saveItem.test.js* — cover saving new items, updates, metadata JSON parsing.
   - *database/subscribeToFeed.test.js* — ensure feed creation, subscription count updates, category defaults.
   - *database/toggleItemLike.test.js* — verify like/unlike flows, socket notification stub.
   - *blog/publishHelpers.test.js* — validate blog formatting functions using sample fixtures.
   - *utils/sanitization.test.js* (if needed) — exercise `getItemDescription` sanitization logic with representative input.

3. **Integration Tests**
   - Minimal handler coverage via stubbed `daveappserver` harness: hit core GET endpoints (`/getfeed`, `/getfeeditems`) and verify responses.
   - Future enhancements: expand to authenticated flows once session strategy is finalized.

4. **Smoke/E2E Scripts**
   - Scripted curl wrapper (e.g., `scripts/smoke.sh`) that hits a handful of representative endpoints and checks HTTP 200.
   - Optional blog publishing smoke (`node blog.js` with fixtures) to mimic manual checks Dave performs.

5. **Performance Baselines (optional stretch)**
   - Add a script (e.g., `scripts/bench-getriver.js`) to time `getRiver` with a fixture dataset.
   - Store baseline numbers in `notes/codeReviews/perfBaselines.md` for future comparison.

Supporting Tasks
- Fixtures: create small JSON/SQL files representing feeds, items, subscriptions, reading lists.
- DB setup: add helper to spin up test schema (could reuse `davesql` with separate config pointing to a local MySQL instance; consider SQLite fallback if feasible).
- Documentation: update `README.md` and `notes/codeReviews/testing.md` with run commands and developer expectations.
- Automation helper: `scripts/run-tests.sh` installs MySQL via Homebrew when needed, provisions a temporary DB using `scripts/setup.js`, runs `npm test`, and tears everything down.

Tracking & Ownership
- [x] Scaffold test environment (`tests/`, npm script, helper config). (Owner JES)
- [x] Implement database unit tests. (Owner JES)
- [x] Implement blog/utils unit tests. (Owner JES)
- [x] Add HTTP integration tests with temporary DB. (Owner JES)
- [ ] Document smoke test script and include in release checklist. (Owner JES)
- [ ] Capture performance baseline (optional). (Owner JES)

#### 11/02/25; 05:05:00 PM by Codex -- Follow-up test ideas with real dependencies

Now that `scripts/run-tests.sh` installs Dave-owned packages on the fly, we can expand coverage without relying on the old shim harness. Candidate additions:

1. **Subscription lifecycle**  
   - Exercise `/subscribe`, `/unsubscribe`, and `/unsublist` via the HTTP handler, confirming that `feedlanddatabase` writes expected SQL and updates categories correctly.
2. **Authenticated category management**  
   - Add tests for `/setsubscriptioncategories` and verifying that category strings are normalized (comma-wrapped) when saved.
3. **River generation paths**  
   - Cover an OPML-driven river endpoint (`/getriverfromlist` or `/getriver`) with a small fixture list to ensure joins and limits hold with real database helpers.
4. **Reading list reconciliation**  
   - Simulate `/checkreadinglist` or `/subscribetoreadinglist`, stubbing only the external HTTP fetch but exercising the database diff logic.
5. **Blog markdown/HTML handling**  
   - With `marked` available, assert that `blog.writePost`/`getBlogPostText` produce both HTML and Markdown variants as upstream expects.
6. **Failure propagation**  
   - Inject SQL and network errors within `database.subscribeToFeed` and `feedland` HTTP handlers to ensure 500s bubble up cleanly without leaving resources altered.
7. **Background tasks wiring**  
   - Verify that `feedland.start` attaches `feedlanddatabase.updateNextFeedIfReady`, `checkNextReadingListfReady`, and `clearCachedRivers` when present, guarding against regressions when upstream toggles those helpers.

Next pass: scope each idea, decide required fixtures/stubs, and prioritize based on upstream risk (subscription flows and auth-protected routes first). Track progress here as suites land.

#### 11/02/25; 05:25:00 PM by Codex -- Progress on subscription coverage

- Added HTTP handler tests for `/subscribe`, `/unsubscribe`, and `/unsublist`, verifying the routes resolve caller identity via `getUserRecFromEmail` and dispatch to the correct database helpers (`tests/http/httpHandlers.test.js`).
- Extended database unit tests to cover `deleteReadingListSubscription` and `isUserSubscribed`, ensuring list-specific subscriptions are reference-counted via `urlReadingList` (`tests/database/subscribeToFeed.test.js`).
- Introduced fixture feeds (RSS 2.0, Atom 1.0, RSS 1.0) plus parsing tests so we have local artifacts for every format supported by `reallysimple` (`tests/fixtures/feeds/`, `tests/feeds/formatParsing.test.js`).
- Added POST `/opmlsubscribe` coverage and a dedicated reading-list sync test that stubs OPML retrieval to validate `checkSubsForOneUserAndOneReadingList` without network calls (`tests/http/httpHandlers.test.js`, `tests/database/readingListSync.test.js`).
