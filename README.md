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
$ aio plugins:install @adobe/aio-cli-plugin-aem-rde
```

# Updating

```
$ aio plugins:update
```

# Getting started

## Configuration to be used in command line

The plugin needs to be configured to point to an existing RDE environment. To do so, the organization, program and environment must be configured accordingly.
As a user, use below command to do so.

```
$ aio login
$ aio aem:rde:setup
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
 $ aio config:set cloudmanager_orgid <org-id>
 $ aio config:set cloudmanager_programid <program-id>
 $ aio config:set cloudmanager_environmentid <env-id>
```

> **Note**:
> Working with multiple environments: it is highly recommend to use the flag `-l` or `--local` together with the `config:set` so that the configuration is stored in the local directory (i.e. the config is only effective in the current directory). For details on different config locations refer to [aio-lib-core-config's README](https://github.com/adobe/aio-lib-core-config#persistent-file-locations). Also, make use of the possibility to store the login information in seperate contexts locally. [Follow the RDE documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/rapid-development-environments#installing-the-rde-command-line-tools) for further information, take a close look to the step 3 details.

### Configuration for experimental commands

⚠️ **WARNING**: These are **experimental features**! It may not work, may not (yet) be available and may be removed without notice. ⚠️

#### Enable `aio aem rde inspect` commands

If you want to enable this experimental feature, run the following command:

```
$ aio config set -l -j aem-rde.experimental-features '["aem:rde:inspect"]'
```

#### Enable `aio aem rde snapshot` commands

If you want to enable this experimental feature, run the following command:

```
$ aio config set -l -j aem-rde.experimental-features '["aem:rde:snapshot"]'
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
