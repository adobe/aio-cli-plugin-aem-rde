---
name: E2E testing
description: This skill should be used when the user asks to "run the tests", "run unit tests", "run e2e tests", "run the e2e suite", "test this plugin", "npm test", or wants to fix a failing/skipped test run in this repo (aio-cli-plugin-aem-rde). Covers the Node version requirement, the mocked unit-test suite, and the opt-in E2E suite that hits a real RDE.
---

# Testing aio-cli-plugin-aem-rde

## Node version

Run all test commands under **Node 22.x** (or 18.x/20.x per `package.json` `engines`).

`node_modules/mocha` (10.8.2) bundles `yargs@16.2.0`, whose `package.json` declares
`"type": "module"` even though its extensionless entry script uses `require()`. Very
new Node versions (observed: v26.7.0) enforce strict ESM resolution for that file and
crash immediately with:

```
ReferenceError: require is not defined in ES module scope, you can use import instead
    at .../node_modules/mocha/node_modules/yargs/yargs:3:69
```

If `node --version` reports something other than 18.x/20.x/22.x, switch first:

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 22
```

(`nvm use` only affects the current shell process, so it must run in the **same**
command invocation as the `npm run` call that follows it, e.g. chained with `&&`.)

## Unit tests (mocked, safe to run anytime)

```bash
npm test          # nyc + mocha, excludes test/e2e/**
npm run lint
npm run format    # prettier --check
```

These never touch a real backend and require no setup.

## E2E tests (opt-in, hits a real RDE — read before running)

`test/e2e/**/*.e2e.test.js` runs the real CLI against a real, disposable/scratch RDE
environment, including snapshot `create`/`restore`/`delete` which mutate content and
lock the RDE for several minutes. **Never point this at a shared or important
environment.** Full details: README.md "End-to-end (E2E) testing".

### No env vars required — everything comes from `.aio`

```bash
npm run test:e2e         # full suite, up to ~30 min, includes snapshot lifecycle
# or
npm run test:e2e:fast    # skips the ~20min snapshot-lifecycle spec
```

Optional overrides (rarely needed): `RDE_E2E_CONTEXT` (non-default IMS context/login),
`RDE_E2E_WORKSPACE_DIR`, `RDE_E2E_TIMEOUT_SHORT_MS` / `_CREATE_MS` / `_RESTORE_MS`.

### Full output is also saved to `test-output/`

Both scripts pipe their combined stdout/stderr through `scripts/test-with-log.sh`,
which mirrors the full mocha run into a log file while still exiting with mocha's own
exit code (via `pipefail`) - `npm test` failing/succeeding is unaffected:

- `npm run test:e2e` → `test-output/e2e.log`
- `npm run test:e2e:fast` → `test-output/e2e-fast.log`

Each file is overwritten on every run (not timestamped) and the directory is
gitignored. After a run, read the relevant log file directly instead of relying on
scrollback or a background-task's own temp output path.

### The "last RDE command ran more than 24h ago" prompt

Any `bin/run`/`aio aem rde ...` command invoked **without** `--json`/`--quiet` shows an
interactive `inquirer` confirmation - `The last RDE command ran more than 24h ago, do
you want to continue running the command on <env>? (Y/n)` - whenever `rde_lastaction`
is stale (see `src/lib/base-command.js` `run()`). It defaults to yes, so **answer
yes** (just press enter, or pipe `y`) to proceed. Note this value lives in the
*global* `~/.config/aio` (or `$XDG_CONFIG_HOME/aio`) file, not the workspace's local
`.aio` - it's shared across every program/environment on the machine, not
per-workspace. Also note `--json`-mode commands never refresh it (the whole
check-and-set block is skipped when `--json` is set), so it can go stale for a long
time on a machine that's only ever driven through `--json` calls or the E2E suite.

- When running a command manually via Bash for debugging (e.g. `aem:rde:delete`,
  `aem:rde:logs`), stdin isn't a TTY, so either pipe an answer in or the prompt reads
  EOF immediately and aborts the command (exit 130) - e.g.
  `echo y | node bin/run aem:rde:delete <id> --target author` (run from the workspace
  dir so the right `.aio` is picked up).
- **The automated mocha E2E suite handles this itself**: `pretest:e2e`/
  `pretest:e2e:fast` (npm pre-hooks, see `scripts/refresh-rde-lastaction.js`) refresh
  `rde_lastaction` right before mocha runs, so the two specs that invoke `bin/run`
  without `--json` (`install.e2e.test.js`'s delete-content-package test, and all of
  `logs.e2e.test.js`, since `aem:rde:logs` sets `enableJsonFlag: false`) never hit the
  prompt. If you ever see a generic `Command failed` error or a SIGINT that doesn't
  exit cleanly from one of those two specs in `test-output/e2e*.log` despite this,
  suspect the pre-hook didn't run (e.g. you invoked `mocha` directly instead of
  `npm run test:e2e[:fast]`) rather than a real regression.

## test/workspace/.aio config
The config should look like the example config: test/workspace/.aio.example. 
If not, we need to do a setup.
If extra keys are there that is fine, but at least the keys that are in the example should be there.

### In case of no / improper .aio config

Step 1: 
```bash
cd test/workspace

aio logout
aio login 

# wait for user to login and select the organization, then run:

aio aem rde setup

# this should setup the proper file
```


### The gate reads straight from the present `.aio` config

`test/e2e/lib/env.js` reads `cloudmanager_programid` / `cloudmanager_environmentid` /
`aem-rde.e2e.confirmed` directly from the E2E workspace's `.aio` file (default
`test/workspace/.aio`, gitignored) — there are no `RDE_E2E_PROGRAM_ID` /
`RDE_E2E_ENVIRONMENT_ID` / `RDE_E2E_CONFIRM` env vars to keep in sync with it anymore.
The snapshot commands don't accept `--programId`/`--environmentId` at all, so they can
only ever target whatever is in that same persisted `.aio` config — reading it directly
here means there's nothing that can drift out of sync. If any of the three values are
missing, every spec silently skips with a `Skipping E2E tests - missing/unset in
.../.aio: ...` reason — this is not an error, mocha will just report specs as
skipped/pending.

**Symptom → cause:**
- "Everything skips" → read `test/workspace/.aio` with `hjson.parse` (it's hjson,
  unquoted keys — plain `JSON.parse` throws) and check `cloudmanager_programid`,
  `cloudmanager_environmentid`, and `aem-rde.e2e.confirmed` are all set.
- To repoint the workspace config at a different program/environment, or to set the
  one-time confirmation:
  ```bash
  cd test/workspace
  aio config:set -l cloudmanager_programid <newProgramId>
  aio config:set -l cloudmanager_environmentid <newEnvironmentId>
  aio config:set -l -j aem-rde.e2e.confirmed true
  ```
  Use the globally-installed `aio` CLI here, not this repo's `bin/run` — `bin/run`
  only exposes this plugin's own `aem:rde:*` commands, not the base `config:set`
  command.
- One-time setup (login, experimental-feature enablement, disclaimer acceptance)
  must already be done in the workspace dir before any of this works — see README.md
  "End-to-end (E2E) testing" steps under "Run these once, before running the E2E
  suite".

### Quick diagnostic

To check whether the gate will pass without actually running the suite:

```bash
node -e "
const { getE2EConfig } = require('./test/e2e/lib/env');
console.log(getE2EConfig());
"
```

`enabled: true` means the suite will actually run against the target environment;
`enabled: false` prints the exact skip reason.
