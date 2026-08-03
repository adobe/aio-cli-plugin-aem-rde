# aio-cli-plugin-aem-rde

[Adobe I/O CLI](https://github.com/adobe/aio-cli) Plugin for interactions with
AEM Rapid Development Environments.

# Requirements

- [Adobe I/O CLI](https://github.com/adobe/aio-cli)
  - 10.3.x or higher
  - 11.x or higher
- Node.js version compatibility:
  - 18.x -- 18.0.0 or higher.
  - 20.x -- 20.11.0 or higher.
  - 22.x -- 22.15.0 or higher.
  - Use with odd Node versions is _not_ recommended.

# Installation

```
aio plugins:install @adobe/aio-cli-plugin-aem-rde
```

# Updating

```
aio plugins:update
```

# Getting started

## Configuration to be used in command line

The plugin needs to be configured to point to an existing RDE environment. To do so, the organization, program and environment must be configured accordingly.
As a user, use below command to do so.

```
aio login
aio aem:rde:setup
```

The setup command offers the following functionality:

- Change from one program/environment to another.
- Display the previously active configuration when changed.
- Store the configuration locally in a `.aio` file in the current folder. This allows to setup a config for each RDE independently.
- Switch organization by `aio logout` and then use the setup command again.

> **Note**:
> Working with multiple environments: it is highly recommended to use the local storage. For details on different config locations refer to [aio-lib-core-config's README](https://github.com/adobe/aio-lib-core-config#persistent-file-locations). However, the default is to use global for users who have one environment only.

## Configuration to be used in build environments

For build environments, include below into the scripts.

```
aio config:set cloudmanager_orgid <org-id>
aio config:set cloudmanager_programid <program-id>
aio config:set cloudmanager_environmentid <env-id>
```

> **Note**:
> Working with multiple environments: it is highly recommend to use the flag `-l` or `--local` together with the `config:set` so that the configuration is stored in the local directory (i.e. the config is only effective in the current directory). For details on different config locations refer to [aio-lib-core-config's README](https://github.com/adobe/aio-lib-core-config#persistent-file-locations). Also, make use of the possibility to store the login information in seperate contexts locally. [Follow the RDE documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/rapid-development-environments#installing-the-rde-command-line-tools) for further information, take a close look to the step 3 details.

### Configuration for experimental commands

⚠️ **WARNING**: These are **experimental features**! It may not work, may not (yet) be available and may be removed without notice. ⚠️

#### Enable `aio aem rde inspect` commands

If you want to enable this experimental feature, run the following command:

```
aio config set -l -j aem-rde.experimental-features '["aem:rde:inspect"]'
```

#### Enable `aio aem rde snapshot` commands

If you want to enable this experimental feature, run the following command:

```
aio config set -l -j aem-rde.experimental-features '["aem:rde:snapshot"]'
```

This command creates a local configuration file `.aio` that contains the information to activate the experimental feature.

## Verifying configuration

1. Run `aio aem rde` for general help.
2. Run `aio aem rde status` to see if the configured environment can be accessed.
3. Run `aio aem rde install --help ` for help about a specific command.
4. Run `aio aem rde logs --help` to see options for tailing logs.

Only if `inspect` topic is [enabled](#configuration-for-experimental-commands):

5. Run `aio aem rde inspect --help` to see if the inspect command can be accessed.

Only if `snapshot` topic is [enabled](#configuration-for-experimental-commands):

6. Run `aio aem rde snapshot --help` to see if the snapshot command can be accessed.

## Running unit tests

1. Run `npm run test`

This both runs the mocha-based unit tests as well as produces a test report table at the end.
A more detailed test report can be found in the `coverage/index.html` file.

## Steps for testing local modifications

1. Clone this repository to a folder.
2. Run `npm install` in the folder.
3. Run `aio plugins:link .` inside your folder.

## End-to-end (E2E) testing

In addition to the mocked unit tests above, this repo has a local, opt-in E2E suite (`test/e2e/`) that runs the real CLI against a real RDE environment, including the full snapshot lifecycle (`create` / `restore` / `delete` / `undelete`), installing an osgi-bundle/content-package (and inspecting/deleting it), tailing logs, and checking update history.

> **⚠️ Warning**: `snapshot restore` replaces the environment's content/deployment state, and both `snapshot create` and `snapshot restore` lock the RDE for several minutes while running. **Only ever point this suite at a disposable/scratch RDE environment that you don't mind being reset or temporarily locked** - never a shared or important one.

These tests are never run as part of `npm test` or CI. They are gated behind explicit environment variables so they can't be triggered by accident.

### One-time setup

The E2E suite reads/writes its `.aio` config from a dedicated **workspace directory**, kept separate from any `.aio` you may already have at this repo's root for your own day-to-day use of the plugin. By default this is `test/workspace/` (already gitignored, since it's covered by the root `.gitignore`'s `.aio` rule); override it with `RDE_E2E_WORKSPACE_DIR` (resolved relative to the repo root) if you'd rather use somewhere else.

Run these once, before running the E2E suite:

```
npm install
aio login
mkdir -p test/workspace
cd test/workspace
node ../../bin/run aem:rde:setup
```

`aem:rde:setup` walks you through picking an org/program/environment and stores the choice locally in `test/workspace/.aio` - point it at your disposable/scratch RDE. Alternatively, set the IDs directly using the real `aio` CLI (`config:set`/`config set` are core `aio` commands, not part of this plugin, so they must be run via `aio`, not `./bin/run`) **from inside `test/workspace/`**, so the values land in the same local `.aio` file:

```
cd test/workspace
aio config:set -l cloudmanager_orgid <org-id>
aio config:set -l cloudmanager_programid <program-id>
aio config:set -l cloudmanager_environmentid <environment-id>
```

Enable the (experimental) snapshot and inspect commands:

```
cd test/workspace
aio config set -l -j aem-rde.experimental-features '["aem:rde:snapshot", "aem:rde:inspect"]'
```

Then run any snapshot command once via `./bin/run`, interactively (no `--json`/`--quiet`), and accept the beta disclaimer when prompted:

```
cd test/workspace
node ../../bin/run aem:rde:snapshot
```

This persists your acceptance locally, so subsequent scripted `--json` runs (used by the E2E suite) never need to prompt.

> **Note**: commands run via `./bin/run` use colon-separated IDs (`aem:rde:snapshot`), not the space-separated form (`aem rde snapshot`) you may be used to from the real `aio` CLI - `./bin/run` only loads this plugin standalone, without the space topic-separator the `aio` CLI host configures. The E2E suite itself (`test/e2e/lib/*.js`) already accounts for this, and always spawns `bin/run` with the resolved workspace directory as its `cwd` so it picks up `test/workspace/.aio` regardless of where you run `npm run test:e2e` from.

### Running the suite

The suite is gated by these environment variables:

- `RDE_E2E_PROGRAM_ID` (required) - the program ID of your disposable/scratch RDE.
- `RDE_E2E_ENVIRONMENT_ID` (required) - the environment ID of your disposable/scratch RDE.
- `RDE_E2E_CONFIRM=yes` (required) - explicit acknowledgment that this run may mutate/lock a real environment.
- `RDE_E2E_CONTEXT` (optional) - passed as `--context` if you use a non-default IMS context/login.

If any of the required variables are missing, the suite reports itself as skipped instead of running.

> **Note**: the snapshot commands don't accept `--programId`/`--environmentId`/`--organizationId` flags at all (only `status` does) - they always target whatever is in the persisted `cloudmanager_programid`/`cloudmanager_environmentid` config. So rather than passing `RDE_E2E_PROGRAM_ID`/`RDE_E2E_ENVIRONMENT_ID` as flags, the suite checks that they **match** the config set up above, and skips (instead of running against the wrong environment) if they don't.

```
RDE_E2E_PROGRAM_ID=12345 \
RDE_E2E_ENVIRONMENT_ID=67890 \
RDE_E2E_CONFIRM=yes \
npm run test:e2e
```

Snapshot `create`/`restore` can realistically take 5-20 minutes against a real backend, so the suite uses generous per-step timeouts; a full run of the snapshot lifecycle spec can take up to ~30 minutes. The test-created snapshot is always cleaned up (soft-delete then force-delete) in an `after()` hook, even if an earlier step in the test fails.

The install spec (`test/e2e/install.e2e.test.js`) deploys a small, publicly available osgi-bundle and content-package (the Adobe WKND reference site) straight from Maven Central by URL, so no binaries need to be downloaded locally or committed to the repo. The osgi-bundle install is cleaned up via `aem:rde:delete` afterwards; the content-package install is **not** cleaned up, since `aem:rde:delete` doesn't support removing content-packages - it accumulates on the target RDE across repeated runs, which is expected for a disposable/scratch environment.

## Exit Codes

Primarily for scripting application purposes, the following exit codes are used:

- 1 - A generic (non-catch) error has occurred
- 2 - A configuration error has occurred
- 3 - A validation error with the supplied flags or arguments has occurred
- 4 - A deployment error has occurred
- 5 - An internal error that might be fixed with a retry has occurred
- 40 - An error emanating from the deployment not being fully performed has occurred. This error might be interpretable by some users as ok if that's a middle step they need to go through

# Releasing a new version

Please read the [RELEASE.md](https://github.com/adobe/aio-cli-plugin-aem-rde/blob/main/RELEASE.md)
