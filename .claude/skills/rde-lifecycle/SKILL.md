---
name: RDE lifecycle (restart/reset/delete artifacts)
description: This skill should be used when the user asks to "restart the RDE", "reset the RDE", "delete a bundle or config from RDE", "aio aem rde restart/reset/delete", or wants to recover an environment that's stuck or misconfigured in this repo (aio-cli-plugin-aem-rde).
---

# Restarting, resetting, and removing artifacts from an RDE

Source: `src/commands/aem/rde/restart.js`, `src/commands/aem/rde/reset.js`,
`src/commands/aem/rde/delete.js`.

> **Naming note**: this top-level `delete` command removes a deployed **artifact**
> (an OSGi bundle or config) by id — it does **not** delete the RDE environment
> itself, and it's unrelated to `aio aem rde snapshot delete` (which soft-deletes a
> snapshot). See the `rde-snapshot` skill for that one.

## `aio aem rde restart`

```bash
aio aem rde restart
```

Restarts both author and publish of the current RDE. No flags beyond the common
`--organizationId`/`--programId`/`--environmentId`/`--quiet`. Blocks until the restart
completes, then fires a desktop notification (if enabled).

## `aio aem rde reset`

```bash
aio aem rde reset                        # full reset, waits for completion (default)
aio aem rde reset --no-wait              # kick off reset, return immediately; poll with `status`
aio aem rde reset --keep-mutable-content # reset deployment but keep author/publish content
aio aem rde reset --force                # don't reuse a previously generated base repo (slower, use when reset is stuck/broken)
```

- Wipes the RDE back to a clean base state (all installed bundles/configs/content
  removed unless `--keep-mutable-content` is set).
- `--wait`/`--no-wait` (default `--wait`) controls whether the command blocks; if not
  waiting, follow up with `aio aem rde status` to watch for "Deployment in progress"
  then `Ready`.
- `--force`/`-f` is the recovery option when a normal reset fails or misbehaves — it's
  slower because it skips reusing a cached base repository.

## `aio aem rde delete <id>`

```bash
aio aem rde delete com.acme.mybundle              # delete an osgi-bundle by symbolic name
aio aem rde delete com.acme.mybundle-1.2.3         # or by symbolic-name-version
aio aem rde delete com.acme.SomeConfigPid --type osgi-config
aio aem rde delete <id> --target publish           # restrict to one tier (default: both author+publish)
aio aem rde delete <id> --force                    # force delete
```

- `<id>` is matched as either an OSGi bundle symbolic name, `symbolicName-version`,
  or an OSGi config PID — whichever matches an artifact currently deployed.
- `--type`/`-t` restricts the search to `osgi-bundle` or `osgi-config` (default:
  search both types).
- `--target` restricts to `author` or `publish` (default: both).
- Throws `DELETE_NOT_FOUND` if no matching artifact is found for the given
  id/type/target combination — double check with `aio aem rde status` or
  `aio aem rde inspect osgi-bundles`/`osgi-configurations` for the exact id first.

## Gotchas

- `reset` and `restart` both operate on the whole environment (both tiers); there's
  no way to restart/reset just one tier.
- After any of these three commands, `aio aem rde status --wait` is the standard way
  to block until the environment is usable again if you didn't already wait inline.
