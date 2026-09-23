---
name: RDE inspect (OSGi/inventory)
description: This skill should be used when the user asks to "inspect OSGi bundles/components/configs/services on RDE", "check inventory on RDE", "aio aem rde inspect", or wants to debug OSGi state on a rapid development environment in this repo (aio-cli-plugin-aem-rde).
---

# Inspecting OSGi state and Sling inventory on an RDE

Source: `src/commands/aem/rde/inspect/{inventory,osgi-bundles,osgi-components,
osgi-configurations,osgi-services}.js`. These are all part of the **experimental**
`aem:rde:inspect` feature — enable it first (see the `rde-setup` skill):

```bash
aio config set -l -j aem-rde.experimental-features '["aem:rde:inspect"]'
```

## Common shape

All five commands follow the same list/detail pattern:

```bash
aio aem rde inspect <subcommand>            # table of all items
aio aem rde inspect <subcommand> <id>       # full detail for one item
```

Common flags across all of them: `--target` (`author`/`publish`, via
`commonFlags.targetInspect`), `--include` (filter, via `commonFlags.include`),
`--quiet`, plus `--organizationId`/`--programId`/`--environmentId` to override the
configured environment. `osgi-bundles`/`osgi-components`/`osgi-services`/
`osgi-configurations` additionally take `--scope` (`commonFlags.scope`).

## Subcommands

- **`osgi-bundles [id]`** — list/detail OSGi bundles. Table columns: ID, name,
  version, state, state string, start level. `id` here is the bundle ID (or you can
  browse the symbolic-name/version pair shown in `status`).
- **`osgi-components [id]`** — list/detail OSGi (DS) components.
- **`osgi-configurations [pId]`** — list/detail OSGi configurations by PID (note the
  arg is named `pId`, not `id`).
- **`osgi-services [id]`** — list/detail registered OSGi services.
- **`inventory [id]`** — list/detail Sling inventory printouts (equivalent to
  `/system/console/status-*` diagnostics pages).

## Example

```bash
aio aem rde inspect osgi-bundles --target publish
aio aem rde inspect osgi-bundles --target publish --include commons-io
aio aem rde inspect osgi-configurations com.day.cq.some.Service
```

## Gotchas

- These commands require the experimental flag to be enabled or they won't be
  registered at all — if a user reports "command not found" for `inspect`, check
  `aem-rde.experimental-features` in the local `.aio` config first.
- Don't confuse this with `aio aem rde status`, which also lists bundles/configs but
  from a different, non-experimental, simpler endpoint (grouped by author/publish,
  no OSGi component/service/inventory detail).
