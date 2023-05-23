# aio-cli-plugin-aem-rde

[Adobe I/O CLI](https://github.com/adobe/aio-cli) Plugin for interactions with
AEM Rapid Development Environments.

# Requirements

- [Adobe I/O CLI](https://github.com/adobe/aio-cli)
- Node.js version compatibility:
  - 16.x -- 16.13.0 or higher.
  - 18.x -- 18.0.0 or higher.
  - Use with odd Node versions is _not_ recommended.

# Installation

```
$ aio plugins:install @adobe/aio-cli-plugin-aem-rde
```

# Updating

```
$ aio plugins:update
```

# Getting started

# Configuration

The plugin needs to be configured to point to an existing RDE environment as follows:

```
 $ aio config:set cloudmanager_orgid <org-id>
 $ aio config:set cloudmanager_programid <program-id>
 $ aio config:set cloudmanager_environmentid <env-id>
```

> **Note**:
> If you are planning to work with multiple environments, we highly recommend you to use the flag `-l` or `--local` together with the `config:set` so that you will store the configuration in the local directory (i.e. the config is only effective in the current directory). For details on different config locations refer to [aio-lib-core-config's README](https://github.com/adobe/aio-lib-core-config#persistent-file-locations).

## Verifying configuration

1. Run `aio login`
2. Run `aio aem:rde` for general help.
3. Run `aio aem:rde:install --help ` for help about a specific command.
4. Run `aio aem:rde:status` to see if the configured environment can be accessed.

## Running unit tests

1. Run `npm run test`

This both runs the mocha-based unit tests as well as produces a test report table at the end.
A more detailed test report can be found in the `coverage/index.thml` file.

## Steps for testing local modifications

1. Clone this repository to a folder.
2. Run `npm install` in the folder.
3. Run `aio plugins:link .` inside your folder.
