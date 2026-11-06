---
name: RDE snapshots
description: This skill should be used when the user asks to "create an RDE snapshot", "list snapshots", "restore a snapshot", "delete/undelete a snapshot", "aio aem rde snapshot", or wants to save/rollback the state of a rapid development environment in this repo (aio-cli-plugin-aem-rde).
---

# RDE snapshot lifecycle

Source: `src/commands/aem/rde/snapshot/{index,create,delete,restore,undelete}.js`.
This is an **experimental** feature — enable it first (see the `rde-setup` skill):

```bash
aio config set -l -j aem-rde.experimental-features '["aem:rde:snapshot"]'
```

⚠️ **Snapshot create/restore lock the RDE for several minutes and mutate its content.**
Never run these against a shared/important environment without confirming with the
environment owner first (the same caution documented in the `E2E-testing` skill,
which exercises these same commands against a real scratch RDE).

## List snapshots

```bash
aio aem rde snapshot                 # table: name, description, usage, size, state, created, last used
aio aem rde snapshot --sort=-'Last Used'   # default sort; prefix '-' reverses
```

## Create a snapshot

```bash
aio aem rde snapshot create my-snapshot -d "before risky migration"
```

- `<name>` must be unique within the environment.
- `-d/--description` is optional.
- Takes several minutes: request (<1m) → backend picks up job (<1m) → lock RDE and
  snapshot content (2-5m) → unlock RDE (1-2m). The command blocks and shows spinners
  for each phase, then polls `status` until the environment is `Ready` again before
  returning.

## Restore a snapshot

```bash
aio aem rde snapshot restore my-snapshot
aio aem rde snapshot restore my-snapshot --only-mutable-content
```

- Rebases the RDE onto the named snapshot; also blocks until the RDE reports `Ready`
  again afterward.
- `--only-mutable-content` restores mutable content only (not the full deployment
  state).
- Check the result afterward with `aio aem rde status`.

## Delete / undelete a snapshot

```bash
aio aem rde snapshot delete my-snapshot         # soft delete, retained 7 days
aio aem rde snapshot delete my-snapshot --force # actually removes it now (skips retention)
aio aem rde snapshot delete --all               # mark all snapshots as deleted
aio aem rde snapshot undelete my-snapshot       # undo a soft delete within the retention window
```

- Default delete is a **soft delete**: the snapshot is marked for deletion and
  actually removed after 7 days unless undeleted first.
- `--force`/`-f` skips the retention window and wipes it immediately — this only
  works on snapshots already in the `removed` state, otherwise you get a
  `SNAPSHOT_WRONG_STATE` error.
- `undelete` has no flags beyond the snapshot name; fails with `SNAPSHOT_LIMIT` if the
  environment is already at its snapshot cap.

## Gotchas

- Don't confuse `snapshot delete <name>` (deletes a *snapshot*) with the top-level
  `aio aem rde delete <id>` (deletes a deployed *osgi-bundle/config artifact* — see
  the `rde-lifecycle` skill).
- All snapshot subcommands require the RDE-type environment (`DIFFERENT_ENV_TYPE`
  error otherwise) and a valid program/environment config
  (`PROGRAM_OR_ENVIRONMENT_NOT_FOUND` otherwise).
- Desktop notifications (if enabled via `rde setup --enable-notifications`) fire when
  create/restore finish — handy since both can take 5+ minutes.
