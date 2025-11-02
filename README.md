# feedlandtesting

This repository is a testing and review sandbox for Dave Winer’s upstream project at <https://github.com/scripting/feedland>. The canonical source still lives in that repo and is edited through Frontier/OPML workflows, so use this fork to stage experiments, document findings, and validate fixes before filing upstream bug reports in <https://github.com/scripting/feedlandDev/issues>.

### Working with FeedLand locally

To install or run a real FeedLand server, follow the <a href="https://github.com/scripting/feedlandInstall/blob/main/docs/setup.md">feedlandInstall</a> instructions against the upstream repository. The docs, scripts, and notes in this fork mirror that environment so agents can reproduce issues and test candidate fixes without touching the canonical code.

If you want to explore just the database layer, continue to consume the `feedlandDatabase` NPM package. Its official sources remain in <a href="https://github.com/scripting/feedland/tree/main/database">scripting/feedland/database</a>; we keep a copy here strictly for reference and local testing.

- ### Scripts

- `scripts/setup.js` &mdash; interactive helper that collects the answers needed for `config.json` (ports, SMTP, MySQL, optional S3/GitHub) and can run `npm install` afterwards. Supply flags to run non-interactively, for example:

  ``
  node scripts/setup.js \
    --non-interactive --port=1452 --domain=localhost:1452 --base-url=http://localhost:1452/ \
    --mysql-host=localhost --mysql-user=feedland --mysql-password=secret --mysql-database=feedland \
    --install-local-mysql --schema=../feedlandInstall/docs/setup.sql
  ``

- `scripts/smoke.sh` &mdash; curl-based smoke test for a running instance. Configure `FEEDLAND_HOST` (and optionally `FEEDLAND_EMAIL`/`FEEDLAND_CODE`).
- `scripts/bench-getriver.js` &mdash; quick latency probe for `/getriver`; set `FEEDLAND_HOST` and `FEEDLAND_BENCH_SCREENNAME`.
- `scripts/run-tests.sh` &mdash; provisioning harness that installs MySQL via Homebrew when needed, creates a timestamped temporary database (for example, `feedland_test_20250308112233`) in `/tmp`, runs `npm test`, and drops the database afterwards. Override MySQL root credentials via `MYSQL_ROOT_USER` / `MYSQL_ROOT_PASS`. Capture output with something like `./scripts/run-tests.sh | tee /tmp/feedland-test.log` if you want a log file.

### Scope of this fork

All documentation under `contributing/` and `notes/` describes the upstream FeedLand service. When you discover bugs or improvements, capture the rationale here, exercise the scripts/tests below, and then file actionable reports in the upstream tracker at <https://github.com/scripting/feedlandDev/issues>. Avoid treating this fork as a production codebase; its purpose is collaborative review and experimentation.
