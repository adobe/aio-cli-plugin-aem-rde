---
name: RDE install/deploy
description: This skill should be used when the user asks to "install a package to RDE", "deploy a bundle/config to RDE", "aio aem rde install", "push a content-package", "deploy dispatcher config or frontend to RDE", or troubleshoot an install failure in this repo (aio-cli-plugin-aem-rde).
---

# Installing/deploying artifacts to an RDE

Source: `src/commands/aem/rde/install.js` (largest command file, ~530 lines).

## Basic usage

```bash
aio aem rde install <location>
```

`<location>` is either a **local file path** or a **public URL** (http/https). The
command auto-detects the artifact `--type` from the file extension/contents when
`--type` isn't given:

| extension/content            | guessed type       |
|-------------------------------|--------------------|
| `.jar`                         | `osgi-bundle`      |
| `.json`                        | `osgi-config`      |
| `.zip` containing `jcr_root/`  | `content-package`  |
| `.zip` containing `conf.dispatcher.d/` | `dispatcher-config` |
| `.zip` containing `dist/` + `package.json` | `frontend` |
| `.zip` containing `*.yaml`     | `env-config`       |
| `.xml` / other, with `--path`  | `content-file` / `content-xml` |

Explicit types available via `--type`/`-t`: `osgi-bundle`, `osgi-config`,
`content-package`, `content-file`, `content-xml`, `dispatcher-config`, `frontend`,
`env-config`.

## Key flags

- `--type`/`-t` — force the artifact type instead of relying on the guess.
- `--path`/`-p` — required for `content-file`/`content-xml` when the file isn't
  under a `jcr_root/` folder (otherwise the JCR path is auto-guessed from the local
  path).
- `--target` (common flag) — `author` or `publish`.
- `--force`/`-f` — force the install even if the RDE is waiting on an upload from a
  previous install that can be skipped.
- `--restart`/`-r` — restart the environment after a successful install (adds
  minutes; only needed for changes that require a full restart — most installs don't).
- `--quiet` — suppresses the progress bar/spinner.

## Directory inputs (special handling)

If `<location>` is a **local directory**, it's only accepted for `frontend` and
`dispatcher-config` types (`env-config` also supports directory input) — the plugin
builds a zip from the directory first via `frontendInputBuild`/`dispatcherInputBuild`/
`configInputBuild` (see `src/lib/frontend.js`, `src/lib/dispatcher.js`,
`src/lib/config.js`). Any other type with a directory input throws an error asking you
to specify `--type` explicitly.

## What happens after upload

The command uploads (`deployFile`/`deployURL` on the Cloud SDK API), shows a progress
bar (KB uploaded), then polls the update's history until it either succeeds or throws
(`throwOnInstallError`) — so a successful `install` blocks until the artifact is fully
applied, not just uploaded. Use `aio aem rde history <id>` afterward to re-inspect the
result.

## Gotchas

- No `--type` and an ambiguous guess (e.g. multiple candidate types) throws
  `INVALID_GUESS_TYPE` — just pass `--type` explicitly.
- `content-file`/`content-xml` without `--path` and not under `jcr_root/` throws
  `MISSING_CONTENT_PATH`.
- Remote URLs redirecting to a URL with a different filename/extension are handled
  (the code re-guesses the type from the effective URL after following the redirect).
