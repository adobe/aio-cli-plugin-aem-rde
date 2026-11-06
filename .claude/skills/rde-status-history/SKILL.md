---
name: RDE status and history
description: This skill should be used when the user asks to "check RDE status", "see if the environment is ready", "wait for the RDE to be ready", "get RDE deployment history", "see what changed on the RDE", or "get logs for update <id>" in this repo (aio-cli-plugin-aem-rde).
---

# Checking RDE status and deployment history

Source: `src/commands/aem/rde/status.js`, `src/commands/aem/rde/history.js`.

## `aio aem rde status`

Lists the bundles/configs currently deployed to author and publish.

```bash
aio aem rde status              # human-readable list
aio aem rde status --json       # structured output (status + author/publish osgiBundles/osgiConfigs)
aio aem rde status --wait       # poll every 10s until status is "Ready", then return
```

- `--wait` (`-w`) is useful right after an `install`/`reset`/`restart`/snapshot
  operation to block until the environment is usable again; it also fires a desktop
  notification (if enabled via `rde setup --enable-notifications`) once ready.
- Also accepts the common flags `--organizationId`, `--programId`, `--environmentId`
  to target a different env than the configured default, and `--quiet`.

## `aio aem rde history [id]`

```bash
aio aem rde history           # list of all updates (changes) applied to the RDE
aio aem rde history 42        # full detail/logs for update id 42
```

- With no `id`: prints `status` + each change entry (via `rde-utils.logChange`); logs
  "There are no updates yet." if empty.
- With an `id`: validates it's a non-negative integer (throws
  `INVALID_UPDATE_ID` otherwise), then streams the deployment log for that specific
  update via `rde-utils.loadUpdateHistory` — this is the same history-polling helper
  used internally by `install`, `delete`, and snapshot create/restore to show
  progress, so `history <id>` is the way to re-inspect an install/delete you already
  triggered (e.g. to get its full log after the fact).

## Gotchas

- Both commands need a working `.aio` config (see the `rde-setup` skill) — if
  `organizationId`/`programId`/`environmentId` aren't resolvable you'll get a
  config/validation error before any network call happens.
- `status --wait` loops indefinitely (10s interval) with no timeout flag — if the
  RDE deployment is actually stuck, you must Ctrl-C it yourself.
