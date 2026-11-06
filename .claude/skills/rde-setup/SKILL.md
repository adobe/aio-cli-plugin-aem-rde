---
name: RDE setup
description: This skill should be used when the user asks to "set up an RDE", "configure aio aem rde", "point the CLI at an environment", "switch RDE program/environment", "enable experimental RDE features", or hits errors like "No configuration found. Please run `aio aem:rde:setup`" in this repo (aio-cli-plugin-aem-rde).
---

# Setting up the CLI to talk to an RDE

Source: `src/commands/aem/rde/setup.js`, README "Getting started".

## One-time login

```bash
aio login
```

Logs into Adobe IMS. Run `aio logout` first if you need to switch Adobe orgs (the
setup command reads whatever org the current IMS context is authenticated against).

## Interactive setup (recommended for local dev)

```bash
aio aem rde setup
```

Walks through, in order:
1. Whether to store answers **locally** (`.aio` file in the current folder) or
   globally — pick local when working with multiple RDEs so each project folder can
   point at a different program/environment.
2. Whether to enable desktop notifications for long-running tasks (reset, snapshot
   create/restore).
3. Organization selection (auto-picked if you only belong to one; otherwise an
   autocomplete prompt, with a manual-ID fallback if IMS returns none).
4. Program selection (autocomplete prompt over programs in the chosen org).
5. Environment selection, filtered to `type === 'rde'` only. If a program has no RDE
   environments you're asked to pick a different program.

Re-running the command shows the previously configured org/program/environment (grayed
out) before applying the new selection, so you can see what changed.

### Useful flags

- `aio aem rde setup --show` (`-s`) — print the current configuration without
  changing anything. Prints "No configuration found..." if setup was never run.
- `aio aem rde setup --enable-notifications` (`-e`) / `--disable-notifications` (`-d`)
  — toggle desktop notifications only, without going through the full wizard.
- This command never supports `--json` (`enableJsonFlag: false`); it's interactive
  only.

## Non-interactive setup (CI / build environments)

```bash
aio config:set cloudmanager_orgid <org-id>
aio config:set cloudmanager_programid <program-id>
aio config:set cloudmanager_environmentid <env-id>
```

Add `-l`/`--local` to scope the config to the current directory instead of the global
`aio` config — important when a machine/CI runner works with more than one
environment. These are plain `aio` (not `aio aem rde`) config keys, consumed by
`base-command.js` on every RDE command invocation.

## Enabling experimental command groups

Both `aem rde inspect` and `aem rde snapshot` are gated behind a local feature flag:

```bash
aio config set -l -j aem-rde.experimental-features '["aem:rde:inspect"]'
aio config set -l -j aem-rde.experimental-features '["aem:rde:snapshot"]'
```

Pass an array with both entries to enable both at once. This writes to the local
`.aio` file; without it, `inspect`/`snapshot` subcommands are hidden/unavailable.

## Verifying the setup

```bash
aio aem rde              # general help / command list
aio aem rde status       # confirms the configured environment is reachable
aio aem rde install --help
```

## Gotchas

- `aio aem rde setup --show` and the wizard both read the **same** `cloudmanager_*`
  keys that plain `config:set` writes — they're interchangeable, just one is
  interactive and one isn't.
- Environment selection is hard-filtered to RDE-type environments only; other Cloud
  Manager environment types never appear in the picker (see the `FIXME` comment in
  `setup.js`).
- If `.aio` config is missing/incomplete, most commands throw
  `MISSING_ORG_ID`/config errors rather than silently falling back — always re-run
  `aio aem rde setup --show` first when debugging "can't find environment" issues.
