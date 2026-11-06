---
name: RDE logs
description: This skill should be used when the user asks to "tail RDE logs", "watch aem logs", "aio aem rde logs", "enable/disable request logging on RDE", "see request logs", or "configure a custom logger on RDE" in this repo (aio-cli-plugin-aem-rde).
---

# Tailing logs and request-logs on an RDE

Source: `src/commands/aem/rde/logs.js` and
`src/commands/aem/rde/inspect/request-logs/{index,enable,disable}.js` (the latter
group is part of the experimental `aem:rde:inspect` feature — see the `rde-setup`
skill to enable it).

## `aio aem rde logs` — live AEM log tail

```bash
aio aem rde logs                       # defaults to INFO level on the root logger
aio aem rde logs -i com.adobe.foo       # INFO on a specific logger/package
aio aem rde logs -d com.adobe.foo -w com.adobe.bar   # mix levels per logger
aio aem rde logs --target publish       # tail the publish tier instead of author
aio aem rde logs --choose               # pick from existing log configurations
```

- Level flags: `-t/--trace`, `-d/--debug`, `-i/--info`, `-w/--warn`, `-e/--error`,
  each repeatable and taking a logger/package name. If none given, defaults to
  `-i ""` (INFO on root).
- `-f/--format` — custom logback pattern, e.g.
  `'%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n'`.
- `-H/--highlight <substring>` — repeatable; highlights matching lines in white.
- `--color`/`--no-colour` — toggle ANSI colorization (default on); colors log lines by
  level (`*TRACE*` gray, `*DEBUG*` cyan, `*INFO*` green, `*WARN*` yellow,
  `*ERROR*` red).
- Never supports `--json` (`enableJsonFlag: false`) — it's an interactive/streaming
  command.
- **Stop with Ctrl-C** — the command registers a SIGINT/SIGTERM handler that deletes
  the temporary log configuration it created on the server before exiting; don't
  `kill -9` it or the log config may be left behind on the RDE (max concurrent log
  configs is limited — you'll be prompted to pick one to replace via
  `--choose`/`removeLogUserPrompt` if you hit the limit).
- Polls every 500ms; this is a live tail, it never terminates on its own.

## `aio aem rde inspect request-logs` (experimental)

```bash
aio aem rde inspect request-logs enable                     # start capturing request logs
aio aem rde inspect request-logs enable -i com.adobe.foo     # with a specific logger level
aio aem rde inspect request-logs enable -p '^/content/.*'    # only requests matching a path regex
aio aem rde inspect request-logs                             # list captured request logs (table)
aio aem rde inspect request-logs <id>                        # full detail for one request log
aio aem rde inspect request-logs disable                     # stop capturing
```

- `enable` flags: `-f/--format`, `-i/--info`, `-d/--debug`, `-w/--warn`, `-e/--error`
  (repeatable logger names, same level semantics as `logs`), and
  `-p/--includePathPatterns` (repeatable regex, request path must match at least one).
- `enable`/`disable` never support `--json`; the list/detail views do.
- Both request-logs commands need `--target` (`author`/`publish` via
  `commonFlags.targetInspect`) and the `aem:rde:inspect` experimental feature enabled.

## Gotchas

- `logs` and `inspect request-logs enable` are two independent features — `logs` is
  the live-tail AEM logger, `request-logs` is HTTP-request-level capture; don't
  confuse the two when a user says "enable logging".
